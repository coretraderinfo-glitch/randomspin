export const NUMBERED_WHEEL_MAX_SEGMENTS = 180;
export const DECORATIVE_LARGE_RANGE_SEGMENTS = 60;

export type WheelMode = "numbered" | "large-range";

export type WheelVisualPlan = {
  mode: WheelMode;
  rangeSize: number;
  renderedSegmentCount: number;
  visualTargetResult: number;
  exactWinnerIndicator: boolean;
};

/**
 * Returns the supplied visual ordering only when it is a complete, exact
 * permutation of the active numbered range. This keeps presentation state
 * from ever changing the set of possible results.
 */
export function getValidVisualNumberOrder(
  from: number,
  to: number,
  visualNumberOrder?: readonly number[],
) {
  const plan = getWheelVisualPlan(from, to, null);
  if (
    plan.mode !== "numbered" ||
    !visualNumberOrder ||
    visualNumberOrder.length !== plan.rangeSize
  ) {
    return null;
  }

  const expected = new Set(
    Array.from({ length: plan.rangeSize }, (_, index) => from + index),
  );
  const received = new Set(visualNumberOrder);
  if (received.size !== expected.size) {
    return null;
  }

  return [...visualNumberOrder].every((value) => expected.has(value))
    ? [...visualNumberOrder]
    : null;
}

export function getWheelVisualPlan(
  from: number,
  to: number,
  winner: number | null,
): WheelVisualPlan {
  const rangeSize = Math.max(to - from + 1, 2);
  const mode: WheelMode =
    rangeSize <= NUMBERED_WHEEL_MAX_SEGMENTS ? "numbered" : "large-range";
  const fallbackResult = Math.min(Math.max(winner ?? from, from), to);

  return {
    mode,
    rangeSize,
    renderedSegmentCount:
      mode === "numbered" ? rangeSize : DECORATIVE_LARGE_RANGE_SEGMENTS,
    visualTargetResult: fallbackResult,
    exactWinnerIndicator: mode === "large-range" && winner !== null,
  };
}

export function calculateTargetRotation(
  from: number,
  to: number,
  winner: number,
  currentRotation: number,
  visualNumberOrder?: readonly number[],
) {
  const plan = getWheelVisualPlan(from, to, winner);
  const currentTurns = Math.ceil(currentRotation / 360);

  if (plan.mode === "large-range") {
    return currentTurns * 360 + 2520;
  }

  const validOrder = getValidVisualNumberOrder(from, to, visualNumberOrder);
  const orderedIndex = validOrder?.indexOf(winner) ?? winner - from;
  const normalizedIndex = Math.min(
    Math.max(orderedIndex, 0),
    plan.rangeSize - 1,
  );
  const segmentAngle = 360 / plan.rangeSize;
  const desired = -((normalizedIndex + 0.5) * segmentAngle);
  return currentTurns * 360 + 2160 + desired;
}
