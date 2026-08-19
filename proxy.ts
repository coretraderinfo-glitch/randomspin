import { NextRequest, NextResponse } from "next/server";

const ADMIN_SESSION_COOKIE = "lucky_admin_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !hasSessionCookie) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (pathname.startsWith("/api/admin") && pathname !== "/api/admin/login" && !hasSessionCookie) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};
