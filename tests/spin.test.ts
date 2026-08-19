import { describe, expect, it } from "vitest";
import { buildEligiblePool, parseExcludedNumbers, selectSecureWinner, SpinValidationError } from "@/lib/spin";

describe("spin selection", () => {
  it("selects a normal spin in range 1-30", () => {
    const result = selectSecureWinner(1, 30, {
      configMin: 1,
      configMax: 30,
      excludedNumbers: []
    });

    expect(result.winner).toBeGreaterThanOrEqual(1);
    expect(result.winner).toBeLessThanOrEqual(30);
    expect(result.eligiblePool).toHaveLength(30);
  });

  it("combines public range with private exclusions", () => {
    const pool = buildEligiblePool(10, 20, {
      configMin: 1,
      configMax: 30,
      excludedNumbers: [7, 18, 25]
    });

    expect(pool).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 19, 20]);
  });

  it("rejects invalid ranges", () => {
    expect(() =>
      selectSecureWinner(30, 1, {
        configMin: 1,
        configMax: 30,
        excludedNumbers: []
      })
    ).toThrow(SpinValidationError);

    expect(() =>
      selectSecureWinner(1, 1, {
        configMin: 1,
        configMax: 30,
        excludedNumbers: []
      })
    ).toThrow("FROM must be lower than TO.");
  });

  it("rejects ranges larger than the allowed maximum", () => {
    expect(() =>
      buildEligiblePool(1, 1001, {
        configMin: 1,
        configMax: 1001,
        excludedNumbers: [],
        maximumAllowedRange: 1000
      })
    ).toThrow("Please choose a range of 1000 numbers or fewer.");
  });

  it("returns no eligible pool when all requested numbers are excluded", () => {
    expect(() =>
      selectSecureWinner(7, 18, {
        configMin: 1,
        configMax: 30,
        excludedNumbers: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
      })
    ).toThrow("No eligible results are currently available for this range.");
  });

  it("never returns excluded numbers across 100,000 selections and stays reasonably uniform", () => {
    const excluded = new Set([7, 18, 25]);
    const seen = new Set<number>();
    const counts = new Map<number, number>();

    for (let index = 0; index < 100_000; index += 1) {
      const result = selectSecureWinner(1, 30, {
        configMin: 1,
        configMax: 30,
        excludedNumbers: [7, 18, 25]
      });

      expect(result.winner).toBeGreaterThanOrEqual(1);
      expect(result.winner).toBeLessThanOrEqual(30);
      expect(excluded.has(result.winner)).toBe(false);
      seen.add(result.winner);
      counts.set(result.winner, (counts.get(result.winner) ?? 0) + 1);
    }

    expect(seen.has(7)).toBe(false);
    expect(seen.has(18)).toBe(false);
    expect(seen.has(25)).toBe(false);

    const eligibleCounts = Array.from(counts.values());
    const expected = 100_000 / 27;
    for (const count of eligibleCounts) {
      expect(count).toBeGreaterThan(expected * 0.82);
      expect(count).toBeLessThan(expected * 1.18);
    }
  });

  it("validates manual excluded-number input", () => {
    expect(parseExcludedNumbers("7,18,25", 1, 30)).toEqual([7, 18, 25]);
    expect(() => parseExcludedNumbers("7,31", 1, 30)).toThrow("Excluded numbers must stay inside the active range.");
  });
});
