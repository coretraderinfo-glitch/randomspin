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

export function getWheelVisualPlan(from: number, to: number, winner: number | null): WheelVisualPlan {
  const rangeSize = Math.max(to - from + 1, 2);
  const mode: WheelMode = rangeSize <= NUMBERED_WHEEL_MAX_SEGMENTS ? "numbered" : "large-range";
  const fallbackResult = Math.min(Math.max(winner ?? from, from), to);

  return {
    mode,
    rangeSize,
    renderedSegmentCount: mode === "numbered" ? rangeSize : DECORATIVE_LARGE_RANGE_SEGMENTS,
    visualTargetResult: fallbackResult,
    exactWinnerIndicator: mode === "large-range" && winner !== null
  };
}

export function calculateTargetRotation(from: number, to: number, winner: number, currentRotation: number) {
  const plan = getWheelVisualPlan(from, to, winner);
  const currentTurns = Math.ceil(currentRotation / 360);

  if (plan.mode === "large-range") {
    return currentTurns * 360 + 2520;
  }

  const normalizedIndex = Math.min(Math.max(winner - from, 0), plan.rangeSize - 1);
  const segmentAngle = 360 / plan.rangeSize;
  const desired = -((normalizedIndex + 0.5) * segmentAngle);
  return currentTurns * 360 + 2160 + desired;
}
