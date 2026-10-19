import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit, resetRateLimitsForTests } from "@/lib/rate-limit";

const redis = vi.hoisted(() => ({
  configured: false,
  issue: null as string | null,
  UPSTASH_REDIS_REST_URL: "https://redis.test",
  UPSTASH_REDIS_REST_TOKEN: "test-token"
}));

vi.mock("@/lib/env", () => ({
  env: redis,
  isRedisRateLimitConfigured: () => redis.configured,
  getRedisRateLimitConfigurationIssue: () => redis.issue
}));

describe("rate limiting", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    redis.configured = false;
    redis.issue = null;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetRateLimitsForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks after the limit is reached", () => {
    return Promise.all([
      rateLimit("ip:1", 2, 60_000),
      rateLimit("ip:1", 2, 60_000),
      rateLimit("ip:1", 2, 60_000)
    ]).then(([first, second, third]) => {
      expect(first.allowed).toBe(true);
      expect(second.allowed).toBe(true);
      expect(third.allowed).toBe(false);
    });
  });

  it("enforces the configured Redis limit while Redis is healthy", async () => {
    redis.configured = true;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ result: 1 }, { result: 1 }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ result: 2 }, { result: 1 }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(rateLimit("redis:healthy", 1, 60_000, { allowOnInfrastructureFailure: true, endpoint: "public spin" })).resolves.toEqual({
      allowed: true
    });
    await expect(rateLimit("redis:healthy", 1, 60_000, { allowOnInfrastructureFailure: true, endpoint: "public spin" })).resolves.toEqual({
      allowed: false
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps a Redis rate-limit rejection as a 429 decision", async () => {
    redis.configured = true;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{ result: 41 }]), { status: 200 })));

    await expect(rateLimit("redis:exceeded", 40, 60_000, { allowOnInfrastructureFailure: true, endpoint: "public spin" })).resolves.toEqual({
      allowed: false
    });
  });

  it("allows draw availability fallback for a fetch failure", async () => {
    redis.configured = true;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(rateLimit("redis:fetch-failure", 40, 60_000, { allowOnInfrastructureFailure: true, endpoint: "public spin" })).resolves.toEqual({
      allowed: true,
      usedAvailabilityFallback: true
    });
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("Rate limit unavailable for public spin; continuing with fallback policy."));
  });

  it("allows a draw to continue when Redis configuration is missing", async () => {
    redis.issue = "missing Redis REST URL or token";
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(rateLimit("redis:missing-config", 40, 60_000, { allowOnInfrastructureFailure: true, endpoint: "public spin" })).resolves.toEqual({
      allowed: true,
      usedAvailabilityFallback: true
    });
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("Rate limit unavailable for public spin; continuing with fallback policy."));
  });

  it("allows a draw to continue when Redis rejects invalid credentials", async () => {
    redis.configured = true;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(rateLimit("redis:invalid-credentials", 40, 60_000, { allowOnInfrastructureFailure: true, endpoint: "public spin" })).resolves.toEqual({
      allowed: true,
      usedAvailabilityFallback: true
    });
  });

  it("allows draw availability fallback when fetch failed because DNS could not resolve Redis", async () => {
    redis.configured = true;
    const dnsError = Object.assign(new Error("getaddrinfo ENOTFOUND redis.test"), { code: "ENOTFOUND" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed", { cause: dnsError })));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(rateLimit("redis:dns-failure", 40, 60_000, { allowOnInfrastructureFailure: true, endpoint: "public spin" })).resolves.toEqual({
      allowed: true,
      usedAvailabilityFallback: true
    });
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("errorCode=ENOTFOUND"));
    expect(warning).not.toHaveBeenCalledWith(expect.stringContaining("redis.test"));
  });

  it("allows draw availability fallback for a Redis provider 5xx", async () => {
    redis.configured = true;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(rateLimit("redis:provider-5xx", 40, 60_000, { allowOnInfrastructureFailure: true, endpoint: "public spin" })).resolves.toEqual({
      allowed: true,
      usedAvailabilityFallback: true
    });
  });

  it("does not apply draw fallback to callers that keep the default security policy", async () => {
    redis.configured = true;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(rateLimit("admin-login:ip", 8, 60_000)).rejects.toMatchObject({ name: "RedisRateLimitUnavailableError" });
  });

  it("keeps security endpoints fail-closed when Redis configuration is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    redis.issue = "missing Redis REST URL or token";

    await expect(rateLimit("admin-login:missing-config", 8, 60_000)).resolves.toEqual({ allowed: false });
    await expect(rateLimit("admin-totp:missing-config", 6, 60_000)).resolves.toEqual({ allowed: false });
  });

  it("keeps security endpoints fail-closed when Redis rejects credentials", async () => {
    redis.configured = true;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));

    await expect(rateLimit("admin-login:invalid-credentials", 8, 60_000)).rejects.toMatchObject({ name: "RedisRateLimitUnavailableError" });
    await expect(rateLimit("admin-totp:invalid-credentials", 6, 60_000)).rejects.toMatchObject({ name: "RedisRateLimitUnavailableError" });
  });
});
