import { describe, expect, it } from "vitest";
import {
  assertMonotonicDeceleration,
  createDecelerationPlan,
  getDecelerationKinematics,
  getMinimumDecelerationStartMs,
  getNeutralVelocity,
  sampleSpinVelocityProfile,
  SPIN_ACCELERATION_MS,
  SPIN_MIN_FAST_MS
} from "@/lib/spin-physics";
import { getWheelVisualPlan } from "@/lib/wheel-visual";

function decelerationVelocitiesForDelay(delayMs: number) {
  return sampleSpinVelocityProfile(delayMs)
    .filter((sample) => sample.phase === "decelerating")
    .map((sample) => sample.velocity);
}

describe("spin physics", () => {
  it("accelerates initially and reaches a stable peak velocity", () => {
    expect(getNeutralVelocity(0)).toBe(0);
    expect(getNeutralVelocity(120)).toBeGreaterThan(getNeutralVelocity(60));
    expect(getNeutralVelocity(360)).toBeGreaterThan(getNeutralVelocity(240));
    expect(getNeutralVelocity(SPIN_ACCELERATION_MS + 200)).toBeCloseTo(getNeutralVelocity(SPIN_ACCELERATION_MS + 1000), 4);
  });

  it("does not begin deceleration too early for a 50ms server response", () => {
    expect(getMinimumDecelerationStartMs(50)).toBe(SPIN_ACCELERATION_MS + SPIN_MIN_FAST_MS);
  });

  it.each([50, 500, 1500, 3000])("keeps post-peak velocity monotonic for a %ims server response", (delayMs) => {
    expect(assertMonotonicDeceleration(decelerationVelocitiesForDelay(delayMs))).toBe(true);
  });

  it("uses the current velocity as the first deceleration velocity without re-acceleration", () => {
    const currentVelocity = getNeutralVelocity(3000);
    const plan = createDecelerationPlan({
      from: 1,
      to: 30,
      winner: 26,
      currentAngle: 1337,
      currentVelocity
    });

    expect(plan.initialVelocity).toBe(currentVelocity);
    expect(getDecelerationKinematics(1337, plan, 16).velocity).toBeLessThanOrEqual(currentVelocity);
  });

  it("lands on the authoritative server winner for numbered ranges", () => {
    const plan = createDecelerationPlan({
      from: 1,
      to: 30,
      winner: 26,
      currentAngle: 725,
      currentVelocity: getNeutralVelocity(1500)
    });
    const visual = getWheelVisualPlan(1, 30, 26);

    expect(visual.visualTargetResult).toBe(26);
    expect(getDecelerationKinematics(725, plan, plan.durationMs).angle).toBe(plan.targetRotation);
  });

  it("keeps existing large-range winner accuracy", () => {
    expect(getWheelVisualPlan(1, 500, 250).visualTargetResult).toBe(250);
    expect(getWheelVisualPlan(1, 1000, 750).visualTargetResult).toBe(750);
  });
});
