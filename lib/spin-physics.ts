import { calculateTargetRotation } from "@/lib/wheel-visual";

export const SPIN_ACCELERATION_MS = 480;
export const SPIN_MIN_FAST_MS = 900;
export const SPIN_TARGET_VELOCITY = 980;
export const SPIN_REDUCED_TARGET_VELOCITY = 220;
export const SPIN_MIN_DECELERATION_MS = 3600;
export const SPIN_REDUCED_DECELERATION_MS = 900;

export type SpinKinematics = {
  angle: number;
  velocity: number;
};

export type DecelerationPlan = {
  targetRotation: number;
  durationMs: number;
  initialVelocity: number;
};

export function getNeutralVelocity(elapsedMs: number, reducedMotion = false) {
  const targetVelocity = reducedMotion
    ? SPIN_REDUCED_TARGET_VELOCITY
    : SPIN_TARGET_VELOCITY;
  const progress = Math.min(Math.max(elapsedMs, 0) / SPIN_ACCELERATION_MS, 1);
  return targetVelocity * (1 - Math.pow(1 - progress, 3));
}

export function nextNeutralKinematics(
  current: SpinKinematics,
  deltaMs: number,
  elapsedMs: number,
  reducedMotion = false,
): SpinKinematics {
  const velocity = getNeutralVelocity(elapsedMs, reducedMotion);
  return {
    angle: current.angle + velocity * (Math.max(deltaMs, 0) / 1000),
    velocity,
  };
}

export function getMinimumDecelerationStartMs(
  serverResponseElapsedMs: number,
  reducedMotion = false,
) {
  if (reducedMotion) {
    return 0;
  }

  return Math.max(
    serverResponseElapsedMs,
    SPIN_ACCELERATION_MS + SPIN_MIN_FAST_MS,
  );
}

function normalizePositiveDegrees(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}

export function createDecelerationPlan({
  from,
  to,
  winner,
  currentAngle,
  currentVelocity,
  reducedMotion = false,
  visualNumberOrder,
}: {
  from: number;
  to: number;
  winner: number;
  currentAngle: number;
  currentVelocity: number;
  reducedMotion?: boolean;
  visualNumberOrder?: readonly number[];
}): DecelerationPlan {
  const baseTarget = calculateTargetRotation(
    from,
    to,
    winner,
    currentAngle,
    visualNumberOrder,
  );
  const targetModulo = normalizePositiveDegrees(baseTarget);
  const currentModulo = normalizePositiveDegrees(currentAngle);
  const directDistance = normalizePositiveDegrees(targetModulo - currentModulo);
  const safeVelocity = Math.max(
    currentVelocity,
    reducedMotion ? SPIN_REDUCED_TARGET_VELOCITY : SPIN_TARGET_VELOCITY * 0.72,
  );
  const minimumDuration = reducedMotion
    ? SPIN_REDUCED_DECELERATION_MS
    : SPIN_MIN_DECELERATION_MS;
  const targetDuration = reducedMotion ? SPIN_REDUCED_DECELERATION_MS : 4600;
  const idealDistance = (safeVelocity * (targetDuration / 1000)) / 2;
  const minimumDistance = (safeVelocity * (minimumDuration / 1000)) / 2;
  const fullTurns = Math.max(
    1,
    Math.ceil(
      (Math.max(idealDistance, minimumDistance) - directDistance) / 360,
    ),
  );
  const distance = directDistance + fullTurns * 360;
  const durationMs = (2 * distance * 1000) / safeVelocity;

  return {
    targetRotation: currentAngle + distance,
    durationMs,
    initialVelocity: safeVelocity,
  };
}

export function getDecelerationKinematics(
  startAngle: number,
  plan: DecelerationPlan,
  elapsedMs: number,
): SpinKinematics {
  const durationSeconds = plan.durationMs / 1000;
  const elapsedSeconds = Math.min(
    Math.max(elapsedMs, 0) / 1000,
    durationSeconds,
  );
  const acceleration = -plan.initialVelocity / durationSeconds;
  const angle =
    startAngle +
    plan.initialVelocity * elapsedSeconds +
    0.5 * acceleration * elapsedSeconds * elapsedSeconds;
  const velocity = Math.max(
    plan.initialVelocity + acceleration * elapsedSeconds,
    0,
  );

  return {
    angle: elapsedMs >= plan.durationMs ? plan.targetRotation : angle,
    velocity,
  };
}

export function sampleSpinVelocityProfile(
  serverResponseElapsedMs: number,
  reducedMotion = false,
) {
  const decelerationStartMs = getMinimumDecelerationStartMs(
    serverResponseElapsedMs,
    reducedMotion,
  );
  const samples: Array<{
    elapsedMs: number;
    velocity: number;
    phase: "accelerating" | "stable" | "decelerating";
  }> = [];

  for (let elapsedMs = 0; elapsedMs <= decelerationStartMs; elapsedMs += 100) {
    samples.push({
      elapsedMs,
      velocity: getNeutralVelocity(elapsedMs, reducedMotion),
      phase: elapsedMs < SPIN_ACCELERATION_MS ? "accelerating" : "stable",
    });
  }

  const currentVelocity = getNeutralVelocity(
    decelerationStartMs,
    reducedMotion,
  );
  const plan = createDecelerationPlan({
    from: 1,
    to: 30,
    winner: 26,
    currentAngle: (currentVelocity * decelerationStartMs) / 1000,
    currentVelocity,
    reducedMotion,
  });

  for (let elapsedMs = 100; elapsedMs <= plan.durationMs; elapsedMs += 100) {
    samples.push({
      elapsedMs: decelerationStartMs + elapsedMs,
      velocity: getDecelerationKinematics(0, plan, elapsedMs).velocity,
      phase: "decelerating",
    });
  }

  return samples;
}

export function assertMonotonicDeceleration(
  velocities: number[],
  tolerance = 0.5,
) {
  for (let index = 1; index < velocities.length; index += 1) {
    if (velocities[index] > velocities[index - 1] + tolerance) {
      return false;
    }
  }

  return true;
}
