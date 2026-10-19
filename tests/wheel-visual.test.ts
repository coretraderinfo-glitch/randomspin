import { describe, expect, it } from "vitest";
import {
  calculateTargetRotation,
  getWheelVisualPlan,
  NUMBERED_WHEEL_MAX_SEGMENTS,
} from "@/lib/wheel-visual";

const ranges = [
  [1, 10],
  [1, 30],
  [1, 100],
  [1, 180],
  [1, 181],
  [1, 500],
  [1, 1000],
] as const;

function representativeWinners(from: number, to: number) {
  const middle = Math.floor((from + to) / 2);
  return Array.from(
    new Set([
      from,
      middle,
      to,
      Math.floor(from + (to - from) * 0.25),
      Math.floor(from + (to - from) * 0.75),
    ]),
  );
}

describe("wheel visual integrity", () => {
  it.each(ranges)(
    "maps every visual target to the server winner for range %i-%i",
    (from, to) => {
      for (const winner of representativeWinners(from, to)) {
        const plan = getWheelVisualPlan(from, to, winner);
        expect(plan.visualTargetResult).toBe(winner);
        expect(calculateTargetRotation(from, to, winner, 0)).toBeGreaterThan(0);
      }
    },
  );

  it("uses exact numbered segments up to 180 and large-range mode above 180", () => {
    expect(getWheelVisualPlan(1, 180, 90).mode).toBe("numbered");
    expect(getWheelVisualPlan(1, 180, 90).renderedSegmentCount).toBe(
      NUMBERED_WHEEL_MAX_SEGMENTS,
    );
    expect(getWheelVisualPlan(1, 181, 90).mode).toBe("large-range");
    expect(getWheelVisualPlan(1, 1000, 500).exactWinnerIndicator).toBe(true);
  });

  it("proves exact large-range winners requested by the audit", () => {
    for (const winner of [1, 250, 500, 750, 1000]) {
      expect(getWheelVisualPlan(1, 1000, winner).visualTargetResult).toBe(
        winner,
      );
    }
  });

  it("targets the segment containing the server winner after a presentation-only shuffle", () => {
    const visualOrder = [4, 1, 5, 2, 3];
    const shuffledTarget = calculateTargetRotation(1, 5, 5, 0, visualOrder);
    const defaultTarget = calculateTargetRotation(1, 5, 5, 0);

    expect(shuffledTarget).toBe(
      calculateTargetRotation(1, 5, 5, 0, [...visualOrder]),
    );
    expect(shuffledTarget).not.toBe(defaultTarget);
  });

  it("rejects incomplete or duplicate visual orders", () => {
    expect(calculateTargetRotation(1, 5, 3, 0, [1, 2, 3])).toBe(
      calculateTargetRotation(1, 5, 3, 0),
    );
    expect(calculateTargetRotation(1, 5, 3, 0, [1, 2, 3, 4, 4])).toBe(
      calculateTargetRotation(1, 5, 3, 0),
    );
  });
});
