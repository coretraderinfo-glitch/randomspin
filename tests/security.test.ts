import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
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
    const previousRailway = process.env.RAILWAY_ENVIRONMENT;
    const previousTrust = process.env.TRUST_PROXY_HEADERS;
    delete process.env.VERCEL;
    delete process.env.RAILWAY_ENVIRONMENT;
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

    if (previousRailway === undefined) {
      delete process.env.RAILWAY_ENVIRONMENT;
    } else {
      process.env.RAILWAY_ENVIRONMENT = previousRailway;
    }

    if (previousTrust === undefined) {
      delete process.env.TRUST_PROXY_HEADERS;
    } else {
      process.env.TRUST_PROXY_HEADERS = previousTrust;
    }
  });

  it("uses Railway X-Real-IP instead of spoofable X-Forwarded-For", () => {
    const previousRailway = process.env.RAILWAY_ENVIRONMENT;
    process.env.RAILWAY_ENVIRONMENT = "staging";

    const request = new NextRequest("https://randomspin-staging.up.railway.app/api/spin", {
      headers: {
        "x-forwarded-for": "198.51.100.99, 198.51.100.100",
        "x-real-ip": "203.0.113.24"
      }
    });

    expect(getClientIp(request)).toBe("203.0.113.24");

    if (previousRailway === undefined) {
      delete process.env.RAILWAY_ENVIRONMENT;
    } else {
      process.env.RAILWAY_ENVIRONMENT = previousRailway;
    }
  });

  it("falls back to an opaque Railway bucket when X-Real-IP is absent", () => {
    const previousRailway = process.env.RAILWAY_ENVIRONMENT;
    process.env.RAILWAY_ENVIRONMENT = "staging";

    const request = new NextRequest("https://randomspin-staging.up.railway.app/api/spin", {
      headers: { "x-forwarded-for": "198.51.100.99" }
    });

    expect(getClientIp(request)).toBe("railway-unknown");

    if (previousRailway === undefined) {
      delete process.env.RAILWAY_ENVIRONMENT;
    } else {
      process.env.RAILWAY_ENVIRONMENT = previousRailway;
    }
  });

  it("does not render encrypted TOTP secrets in admin client components", () => {
    const componentsDir = path.join(process.cwd(), "components/admin");
    const source = fs
      .readdirSync(componentsDir)
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => fs.readFileSync(path.join(componentsDir, file), "utf8"))
      .join("\n");

    expect(source).not.toContain("totpSecretEncrypted");
    expect(source).not.toContain("totpSetupSecretEncrypted");
  });
});
