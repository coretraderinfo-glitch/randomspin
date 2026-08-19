import "server-only";
import { env, isRedisRateLimitConfigured } from "@/lib/env";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
};

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (isRedisRateLimitConfigured()) {
    return redisRateLimit(key, limit, windowMs);
  }

  if (process.env.NODE_ENV === "production") {
    console.error("Production rate limiting requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
    return { allowed: false };
  }

  return memoryRateLimit(key, limit, windowMs);
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

  const response = await fetch(`${redisUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(pipeline),
    cache: "no-store"
  });

  if (!response.ok) {
    console.error("Redis rate limit request failed.");
    return { allowed: false };
  }

  const results = (await response.json()) as Array<{ result?: number | string }>;
  const count = Number(results[0]?.result ?? limit + 1);
  return { allowed: count <= limit };
}

export function resetRateLimitsForTests() {
  buckets.clear();
}
