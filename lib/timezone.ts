export const DEFAULT_TIMEZONE = "Asia/Kuala_Lumpur";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function isValidTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getSafeTimeZone(timezone?: string | null) {
  return timezone && isValidTimeZone(timezone) ? timezone : DEFAULT_TIMEZONE;
}

export function getZonedParts(date: Date, timezone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: getSafeTimeZone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function getTimeZoneOffsetMs(timezone: string, date: Date) {
  const parts = getZonedParts(date, timezone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

export function zonedTimeToUtc(
  timezone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
) {
  const safeTimezone = getSafeTimeZone(timezone);
  const localUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = localUtc - getTimeZoneOffsetMs(safeTimezone, new Date(localUtc));
  utc = localUtc - getTimeZoneOffsetMs(safeTimezone, new Date(utc));
  return new Date(utc);
}

export function startOfZonedDay(date: Date, timezone: string) {
  const parts = getZonedParts(date, timezone);
  return zonedTimeToUtc(timezone, parts.year, parts.month, parts.day);
}

export function startOfZonedWeek(date: Date, timezone: string) {
  const parts = getZonedParts(date, timezone);
  const jsDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  const daysSinceMonday = (jsDay + 6) % 7;
  const localWeekStart = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - daysSinceMonday));
  return zonedTimeToUtc(
    timezone,
    localWeekStart.getUTCFullYear(),
    localWeekStart.getUTCMonth() + 1,
    localWeekStart.getUTCDate()
  );
}

export function startOfZonedMonth(date: Date, timezone: string) {
  const parts = getZonedParts(date, timezone);
  return zonedTimeToUtc(timezone, parts.year, parts.month, 1);
}

export function formatInTimeZone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: getSafeTimeZone(timezone),
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
