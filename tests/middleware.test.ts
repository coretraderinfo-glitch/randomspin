import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

describe("admin middleware", () => {
  it("redirects admin pages without a session cookie", () => {
    const response = proxy(new NextRequest("http://localhost:3000/admin/dashboard"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/login");
  });

  it("allows admin login without a session cookie", () => {
    const response = proxy(new NextRequest("http://localhost:3000/admin/login"));
    expect(response.status).toBe(200);
  });

  it("rejects admin API requests without a session cookie", async () => {
    const response = proxy(new NextRequest("http://localhost:3000/api/admin/wheel"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized." });
  });
});
