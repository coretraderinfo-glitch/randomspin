import "server-only";
import { env, getRedisRateLimitConfigurationIssue, isRedisRateLimitConfigured } from "@/lib/env";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const warningTimes = new Map<string, number>();
const REDIS_REQUEST_TIMEOUT_MS = 2_000;
const WARNING_INTERVAL_MS = 60_000;
let redisAvailability: "configured" | "unavailable" = "configured";

export type RateLimitResult = {
  allowed: boolean;
  usedAvailabilityFallback?: boolean;
};

export type RateLimitOptions = {
  /** Only draw endpoints may opt into continuing when Redis is temporarily unavailable. */
  allowOnInfrastructureFailure?: boolean;
  /** Safe, human-readable endpoint category for the availability warning. */
  endpoint?: string;
};

class RedisRateLimitUnavailableError extends Error {
  constructor(
    readonly errorType: string,
    readonly errorCode?: string
  ) {
    super("Redis rate-limit infrastructure is unavailable.");
    this.name = "RedisRateLimitUnavailableError";
  }
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  try {
    if (isRedisRateLimitConfigured()) {
      return await redisRateLimit(key, limit, windowMs);
    }

    if (options.allowOnInfrastructureFailure) {
      const unavailable = new RedisRateLimitUnavailableError("configuration");
      warnRedisUnavailable(options.endpoint ?? "draw", unavailable);
      return { allowed: true, usedAvailabilityFallback: true };
    }

    if (process.env.NODE_ENV === "production") {
      warnMissingRedisConfiguration();
      return { allowed: false };
    }

    return memoryRateLimit(key, limit, windowMs);
  } catch (error) {
    if (error instanceof RedisRateLimitUnavailableError) {
      redisAvailability = "unavailable";
    }

    if (options.allowOnInfrastructureFailure && error instanceof RedisRateLimitUnavailableError) {
      warnRedisUnavailable(options.endpoint ?? "draw", error);
      return { allowed: true, usedAvailabilityFallback: true };
    }

    throw error;
  }
}

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (current.count >= limit) {
    return { allowed: false };
  }

  current.count += 1;
  return { allowed: true };
}

async function redisRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const redisUrl = env.UPSTASH_REDIS_REST_URL;
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return { allowed: false };
  }

  const windowSeconds = Math.ceil(windowMs / 1000);
  const safeKey = `lucky-spin:rate:${key}`;
  const pipeline = [
    ["INCR", safeKey],
    ["EXPIRE", safeKey, String(windowSeconds), "NX"]
  ];

  let response: Response;
  try {
    response = await fetch(`${redisUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(pipeline),
      cache: "no-store",
      signal: AbortSignal.timeout(REDIS_REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    throw toRedisUnavailableError(error);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || response.status >= 500) {
      throw new RedisRateLimitUnavailableError("http", `HTTP_${response.status}`);
    }

    return { allowed: false };
  }

  const results = (await response.json()) as Array<{ result?: number | string }>;
  const count = Number(results[0]?.result ?? limit + 1);
  redisAvailability = "configured";
  return { allowed: count <= limit };
}

export function resetRateLimitsForTests() {
  buckets.clear();
  warningTimes.clear();
  redisAvailability = "configured";
}

/** This is an availability signal, not a Redis readiness probe. */
export function getRedisRateLimitHealthState(): "configured" | "degraded" | "unavailable" {
  if (!isRedisRateLimitConfigured()) {
    return "degraded";
  }

  return redisAvailability;
}

function toRedisUnavailableError(error: unknown) {
  const details = getSafeErrorDetails(error);
  return new RedisRateLimitUnavailableError(details.type, details.code);
}

function getSafeErrorDetails(error: unknown) {
  let current = error;
  let type: string | undefined;
  let code: string | undefined;

  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { name?: unknown; code?: unknown; cause?: unknown };
    if (!type && typeof candidate.name === "string" && candidate.name) {
      type = candidate.name;
    }
    if (typeof candidate.code === "string" && /^[A-Z0-9_]+$/.test(candidate.code)) {
      code = candidate.code;
      break;
    }
    current = candidate.cause;
  }

  return { type: type ?? "Error", code };
}

function warnRedisUnavailable(endpoint: string, error: RedisRateLimitUnavailableError) {
  const warningKey = `unavailable:${endpoint}:${error.errorType}:${error.errorCode ?? "none"}`;
  if (!shouldLogWarning(warningKey)) {
    return;
  }

  const details = [`endpoint=${endpoint}`, `errorType=${error.errorType}`];
  if (error.errorCode) {
    details.push(`errorCode=${error.errorCode}`);
  }
  console.warn(`Rate limit unavailable for ${endpoint}; continuing with fallback policy. ${details.join(" ")}`);
}

function warnMissingRedisConfiguration() {
  if (!shouldLogWarning("configuration")) {
    return;
  }

  const issue = getRedisRateLimitConfigurationIssue() ?? "unknown Redis configuration issue";
  console.error(`Production rate limiting is unavailable: ${issue}. Requests remain fail-closed.`);
}

function shouldLogWarning(key: string) {
  const now = Date.now();
  const lastWarning = warningTimes.get(key);
  if (lastWarning && now - lastWarning < WARNING_INTERVAL_MS) {
    return false;
  }

  warningTimes.set(key, now);
  return true;
}
