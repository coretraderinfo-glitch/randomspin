import { randomInt } from "node:crypto";
import { z } from "zod";

export const DEFAULT_MAXIMUM_RANGE = 1000;

export const spinRequestSchema = z.object({
  from: z.coerce.number().int().min(-1_000_000).max(1_000_000),
  to: z.coerce.number().int().min(-1_000_000).max(1_000_000)
});

export type WheelRules = {
  configMin: number;
  configMax: number;
  excludedNumbers: number[];
  maximumAllowedRange?: number;
};

export type SpinSelection = {
  winner: number;
  eligiblePool: number[];
  requestedMin: number;
  requestedMax: number;
};

export class SpinValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpinValidationError";
  }
}

export function buildEligiblePool(from: number, to: number, rules: WheelRules) {
  const maximumAllowedRange = rules.maximumAllowedRange ?? DEFAULT_MAXIMUM_RANGE;

  if (from >= to) {
    throw new SpinValidationError("FROM must be lower than TO.");
  }

  if (to - from + 1 > maximumAllowedRange) {
    throw new SpinValidationError(`Please choose a range of ${maximumAllowedRange} numbers or fewer.`);
  }

  const effectiveMin = Math.max(from, rules.configMin);
  const effectiveMax = Math.min(to, rules.configMax);

  if (effectiveMin > effectiveMax) {
    return [];
  }

  const excluded = new Set(rules.excludedNumbers);
  const pool: number[] = [];

  for (let value = effectiveMin; value <= effectiveMax; value += 1) {
    if (!excluded.has(value)) {
      pool.push(value);
    }
  }

  return pool;
}

export function selectSecureWinner(from: number, to: number, rules: WheelRules): SpinSelection {
  const eligiblePool = buildEligiblePool(from, to, rules);

  if (eligiblePool.length === 0) {
    throw new SpinValidationError("No eligible results are currently available for this range.");
  }

  const winner = eligiblePool[randomInt(eligiblePool.length)];

  return {
    winner,
    eligiblePool,
    requestedMin: from,
    requestedMax: to
  };
}

export function parseExcludedNumbers(input: string, min: number, max: number) {
  if (!input.trim()) {
    return [];
  }

  const values = input
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));

  if (values.length !== input.split(",").filter(Boolean).length) {
    throw new SpinValidationError("Use comma-separated whole numbers only.");
  }

  const unique = Array.from(new Set(values));

  for (const value of unique) {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new SpinValidationError("Excluded numbers must stay inside the active range.");
    }
  }

  return unique.sort((a, b) => a - b);
}
