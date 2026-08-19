import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  SPIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(40),
  ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(8)
});

export const env = envSchema.parse(process.env);

export function getSessionSecret() {
  if (!env.NEXTAUTH_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("NEXTAUTH_SECRET is required in production.");
  }

  return env.NEXTAUTH_SECRET ?? "development-only-secret-change-before-production-32";
}

export function getSiteUrl() {
  return env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function isDatabaseConfigured() {
  return Boolean(env.DATABASE_URL);
}

export function isRedisRateLimitConfigured() {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}
