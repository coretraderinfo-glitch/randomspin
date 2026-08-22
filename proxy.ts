import { NextRequest, NextResponse } from "next/server";

const ADMIN_SESSION_COOKIE = "lucky_admin_session";
const isDevelopment = process.env.NODE_ENV === "development";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const siteHostname = new URL(siteUrl).hostname;
const appEnv = process.env.APP_ENV ?? "development";
const noindexPublicDeployment =
  appEnv === "staging" ||
  process.env.VERCEL_ENV === "preview" ||
  (appEnv !== "production" && (siteHostname.endsWith(".vercel.app") || siteHostname.endsWith(".up.railway.app")));

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getContentSecurityPolicy(nonce: string) {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    isDevelopment ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    isDevelopment ? null : "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.upstash.io",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    isDevelopment ? null : "upgrade-insecure-requests"
  ];

  return directives.filter(Boolean).join("; ");
}

function applySecurityHeaders(response: NextResponse, nonce: string) {
  response.headers.set("Content-Security-Policy", getContentSecurityPolicy(nonce));
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if (!isDevelopment && siteUrl.startsWith("https://")) {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  if (noindexPublicDeployment) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

function notFoundResponse(nonce: string) {
  return applySecurityHeaders(new NextResponse("Not Found", { status: 404 }), nonce);
}

export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", getContentSecurityPolicy(nonce));

  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return notFoundResponse(nonce);
  }

  if (pathname.startsWith("/rs-console") && pathname !== "/rs-console/login" && !hasSessionCookie) {
    return applySecurityHeaders(NextResponse.redirect(new URL("/rs-console/login", request.url)), nonce);
  }

  if (pathname.startsWith("/api/admin") && pathname !== "/api/admin/login" && pathname !== "/api/admin/login/totp" && !hasSessionCookie) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized." }, { status: 401 }), nonce);
  }

  return applySecurityHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders
      }
    }),
    nonce
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
