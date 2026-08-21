export type PublicResultTime = {
  localTime: string | null;
  timezoneLabel: string | null;
  utcTime: string;
};

const friendlyTimezoneNames: Record<string, string> = {
  "Asia/Kuala_Lumpur": "Malaysia Time",
  "Asia/Kolkata": "India Time",
  "Europe/London": "UK Time",
  "America/New_York": "Eastern Time",
  "America/Los_Angeles": "Pacific Time"
};

function getOffsetMinutes(date: Date, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return Math.round((asUtc - date.getTime()) / 60000);
}

function getFriendlyAbbreviation(date: Date, timezone: string) {
  const offset = getOffsetMinutes(date, timezone);

  if (timezone === "Asia/Kuala_Lumpur") {
    return "MYT";
  }

  if (timezone === "Asia/Kolkata") {
    return "IST";
  }

  if (timezone === "Europe/London") {
    return offset === 60 ? "BST" : "GMT";
  }

  if (timezone === "America/New_York") {
    return offset === -240 ? "EDT" : "EST";
  }

  if (timezone === "America/Los_Angeles") {
    return offset === -420 ? "PDT" : "PST";
  }

  return null;
}

function getTimezoneName(date: Date, timezone: string, locale: string) {
  const friendlyAbbreviation = getFriendlyAbbreviation(date, timezone);

  if (friendlyAbbreviation) {
    return friendlyAbbreviation;
  }

  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    timeZoneName: "short"
  }).formatToParts(date);

  return parts.find((part) => part.type === "timeZoneName")?.value ?? null;
}

function formatDateTime(date: Date, timezone: string, locale: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );

  return `${parts.day} ${parts.month} ${parts.year} • ${parts.hour}:${parts.minute}:${parts.second} ${String(
    parts.dayPeriod
  ).toUpperCase()}`;
}

export function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function formatUtcTime(timestamp: string) {
  const date = new Date(timestamp);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(
    date.getUTCSeconds()
  ).padStart(2, "0")} UTC`;
}

export function formatPublicResultTime(timestamp: string, timezone = getBrowserTimezone(), locale = "en-MY"): PublicResultTime {
  const date = new Date(timestamp);
  const utcTime = formatUtcTime(timestamp);

  if (!timezone || Number.isNaN(date.getTime())) {
    return {
      localTime: null,
      timezoneLabel: null,
      utcTime
    };
  }

  try {
    const abbreviation = getTimezoneName(date, timezone, locale);
    const friendlyName = friendlyTimezoneNames[timezone];

    return {
      localTime: formatDateTime(date, timezone, locale),
      timezoneLabel: friendlyName && abbreviation ? `${friendlyName} (${abbreviation})` : abbreviation,
      utcTime
    };
  } catch {
    return {
      localTime: null,
      timezoneLabel: null,
      utcTime
    };
  }
}
