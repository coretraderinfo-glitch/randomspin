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
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalNonEmptyString,
  SPIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(40),
  ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(8)
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
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

export function isPublicIndexingDisabled() {
  return (
    env.APP_ENV === "staging" ||
    process.env.VERCEL_ENV === "preview" ||
    (env.APP_ENV !== "production" && (siteHostname.endsWith(".vercel.app") || siteHostname.endsWith(".up.railway.app")))
  );
}
