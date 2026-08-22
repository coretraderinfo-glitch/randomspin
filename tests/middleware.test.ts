import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

describe("admin middleware", () => {
  it("returns 404 for old admin page routes without revealing the console route", () => {
    const response = proxy(new NextRequest("http://localhost:3000/admin/dashboard"));
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src 'self' 'nonce-");
  });

  it("redirects private console pages without a session cookie", () => {
    const response = proxy(new NextRequest("http://localhost:3000/rs-console/dashboard"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/rs-console/login");
  });

  it("allows console login without a session cookie", () => {
    const response = proxy(new NextRequest("http://localhost:3000/rs-console/login"));
    expect(response.status).toBe(200);
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
  });

  it("allows the admin TOTP login API without a full session cookie", () => {
    const response = proxy(new NextRequest("http://localhost:3000/api/admin/login/totp"));
    expect(response.status).toBe(200);
  });

  it("rejects admin API requests without a session cookie", async () => {
    const response = proxy(new NextRequest("http://localhost:3000/api/admin/wheel"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized." });
  });

  it("leaves public pages unaffected", () => {
    const response = proxy(new NextRequest("http://localhost:3000/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
