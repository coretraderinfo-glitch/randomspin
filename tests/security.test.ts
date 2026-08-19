import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { assertSameOrigin, getClientIp, requireSameOrigin } from "@/lib/security";

describe("security helpers", () => {
  it("requires origin for hardened admin state changes", () => {
    const request = new NextRequest("http://localhost:3000/api/admin/settings", { method: "PUT" });
    expect(assertSameOrigin(request)).toBe(true);
    expect(requireSameOrigin(request)).toBe(false);
  });

  it("accepts same-origin and rejects foreign origin", () => {
    const same = new NextRequest("http://localhost:3000/api/admin/settings", {
      method: "PUT",
      headers: { origin: "http://localhost:3000" }
    });
    const foreign = new NextRequest("http://localhost:3000/api/admin/settings", {
      method: "PUT",
      headers: { origin: "https://evil.example" }
    });

    expect(requireSameOrigin(same)).toBe(true);
    expect(requireSameOrigin(foreign)).toBe(false);
  });

  it("does not trust proxy IP headers outside Vercel/trusted proxy mode", () => {
    const previousVercel = process.env.VERCEL;
    const previousTrust = process.env.TRUST_PROXY_HEADERS;
    delete process.env.VERCEL;
    delete process.env.TRUST_PROXY_HEADERS;

    const request = new NextRequest("http://localhost:3000/api/spin", {
      headers: { "x-forwarded-for": "203.0.113.9" }
    });

    expect(getClientIp(request)).toBe("local-development");
    if (previousVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = previousVercel;
    }

    if (previousTrust === undefined) {
      delete process.env.TRUST_PROXY_HEADERS;
    } else {
      process.env.TRUST_PROXY_HEADERS = previousTrust;
    }
  });
});
