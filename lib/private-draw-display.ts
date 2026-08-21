export const PRIVATE_DRAW_WHEEL_DISPLAY = "WHEEL";
export const PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY = "NUMBER_ROLLER";
export const PRIVATE_DRAW_SLOT_NUMBER_DISPLAY = "SLOT_NUMBER";
export const PRIVATE_DRAW_CARD_REVEAL_DISPLAY = "CARD_REVEAL";

export const privateDrawDisplayStyles = [
  PRIVATE_DRAW_WHEEL_DISPLAY,
  PRIVATE_DRAW_NUMBER_ROLLER_DISPLAY,
  PRIVATE_DRAW_SLOT_NUMBER_DISPLAY,
  PRIVATE_DRAW_CARD_REVEAL_DISPLAY
] as const;

export type PrivateDrawDisplayStyle = (typeof privateDrawDisplayStyles)[number];

export function isPrivateDrawDisplayStyle(value: unknown): value is PrivateDrawDisplayStyle {
  return typeof value === "string" && privateDrawDisplayStyles.includes(value as PrivateDrawDisplayStyle);
}

export function normalizePrivateDrawDisplayStyle(value: unknown): PrivateDrawDisplayStyle {
  return isPrivateDrawDisplayStyle(value) ? value : PRIVATE_DRAW_WHEEL_DISPLAY;
}
