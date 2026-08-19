import { describe, expect, it, beforeEach } from "vitest";
import { rateLimit, resetRateLimitsForTests } from "@/lib/rate-limit";

describe("rate limiting", () => {
  beforeEach(() => resetRateLimitsForTests());

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
});
