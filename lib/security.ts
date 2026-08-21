import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionSecret, getSiteUrl } from "@/lib/env";

export function sanitizeUserAgent(userAgent: string | null) {
  return userAgent?.slice(0, 240) ?? null;
}

export function getClientIp(request: NextRequest) {
  if (process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.TRUST_PROXY_HEADERS === "true") {
    return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  }

  return "local-development";
}

export function hashIp(ip: string) {
  return createHash("sha256").update(`${getSessionSecret()}:${ip}`).digest("hex");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function assertSameOrigin(request: NextRequest, options: { requireOrigin?: boolean } = {}) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return !options.requireOrigin;
  }

  const allowed = new URL(getSiteUrl()).origin;
  const hostOrigin = `${request.nextUrl.protocol}//${request.headers.get("host")}`;

  return origin === allowed || origin === hostOrigin;
}

export function requireSameOrigin(request: NextRequest) {
  return assertSameOrigin(request, { requireOrigin: true });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
