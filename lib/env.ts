import { z } from "zod";

const optionalNonEmptyString = z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());
const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional());
const appEnvSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? "development" : value),
  z.enum(["development", "staging", "production"])
);

const envSchema = z.object({
  APP_ENV: appEnvSchema,
  DATABASE_URL: optionalNonEmptyString,
  DIRECT_URL: optionalNonEmptyString,
  SQLITE_DATABASE_URL: optionalNonEmptyString,
  NEXTAUTH_SECRET: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(32).optional()),
  NEXT_PUBLIC_SITE_URL: optionalUrl,
  // Redis availability must not prevent the application from starting. The
  // rate-limit module validates this value before it attempts a request.
  UPSTASH_REDIS_REST_URL: optionalNonEmptyString,
  UPSTASH_REDIS_REST_TOKEN: optionalNonEmptyString,
  ADMIN_TOTP_ENCRYPTION_KEY: optionalNonEmptyString,
  SPIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(40),
  ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(8),
  ADMIN_TOTP_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(6)
});

export const env = envSchema.parse(process.env);

const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const siteHostname = new URL(siteUrl).hostname;
const hostedDeployment = Boolean(process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
const requiresPostgres = hostedDeployment || env.APP_ENV === "staging" || env.APP_ENV === "production";

function isPostgresUrl(value: string | undefined) {
  return Boolean(value && /^postgres(?:ql)?:\/\//.test(value));
}

if (requiresPostgres && env.SQLITE_DATABASE_URL) {
  throw new Error("SQLITE_DATABASE_URL is local-development only and must not be configured for hosted staging/production.");
}

if (requiresPostgres && !isPostgresUrl(env.DATABASE_URL)) {
  throw new Error("Hosted staging/production requires a PostgreSQL DATABASE_URL.");
}

export function getSessionSecret() {
  if (!env.NEXTAUTH_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("NEXTAUTH_SECRET is required in production.");
  }

  return env.NEXTAUTH_SECRET ?? "development-only-secret-change-before-production-32";
}

export function getAdminTotpEncryptionKey() {
  const key = process.env.ADMIN_TOTP_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ADMIN_TOTP_ENCRYPTION_KEY is required before enabling or using admin TOTP 2FA.");
  }

  return key;
}

export function getSiteUrl() {
  return siteUrl;
}

export function getAppEnv() {
  return env.APP_ENV;
}

export function isDatabaseConfigured() {
  return Boolean(env.DATABASE_URL || env.SQLITE_DATABASE_URL);
}

export function isRedisRateLimitConfigured() {
  return getRedisRateLimitConfigurationIssue() === null;
}

export function getRedisRateLimitConfigurationIssue() {
  const redisUrl = env.UPSTASH_REDIS_REST_URL;
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return "missing Redis REST URL or token";
  }

  try {
    const parsed = new URL(redisUrl);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || !parsed.hostname) {
      return "invalid Redis REST URL";
    }
  } catch {
    return "invalid Redis REST URL";
  }

  return null;
}

export function isPublicIndexingDisabled() {
  return (
    env.APP_ENV === "staging" ||
    process.env.VERCEL_ENV === "preview" ||
    (env.APP_ENV !== "production" && (siteHostname.endsWith(".vercel.app") || siteHostname.endsWith(".up.railway.app")))
  );
}
