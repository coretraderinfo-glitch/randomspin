export const MIN_DRAW_NUMBER = 0;
export const MAX_DRAW_NUMBER = 1000;
export const MAX_DRAW_RANGE_SIZE = 1000;
export const MAX_DRAW_NUMBER_LABEL = "1,000";

export const WHOLE_NUMBER_RANGE_ERROR = "Enter a whole number.";
export const RANGE_ORDER_ERROR = "FROM must be smaller than TO.";
export const MAX_DRAW_NUMBER_ERROR = `Maximum supported number is ${MAX_DRAW_NUMBER_LABEL}.`;
export const MIN_DRAW_NUMBER_ERROR = `Minimum supported number is ${MIN_DRAW_NUMBER}.`;
export const MAX_DRAW_RANGE_SIZE_ERROR = `Range can include at most ${MAX_DRAW_NUMBER_LABEL} numbers.`;

export function validateDrawRangeValues({
  from,
  to,
  maximumRangeSize = MAX_DRAW_RANGE_SIZE,
  allowNegative = false
}: {
  from: number;
  to: number;
  maximumRangeSize?: number;
  allowNegative?: boolean;
}) {
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    return WHOLE_NUMBER_RANGE_ERROR;
  }

  if (!allowNegative && (from < MIN_DRAW_NUMBER || to < MIN_DRAW_NUMBER)) {
    return MIN_DRAW_NUMBER_ERROR;
  }

  if (from >= to) {
    return RANGE_ORDER_ERROR;
  }

  if (from > MAX_DRAW_NUMBER || to > MAX_DRAW_NUMBER) {
    return MAX_DRAW_NUMBER_ERROR;
  }

  if (to - from + 1 > Math.min(maximumRangeSize, MAX_DRAW_RANGE_SIZE)) {
    return MAX_DRAW_RANGE_SIZE_ERROR;
  }

  return null;
}
