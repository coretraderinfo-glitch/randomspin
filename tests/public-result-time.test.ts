import { describe, expect, it, vi } from "vitest";
import { formatPublicResultTime, getBrowserTimezone } from "@/lib/public-result-time";

describe("public result time formatting", () => {
  const timestamp = "2026-08-19T10:21:16.000Z";

  it("formats Malaysia local time from the server timestamp", () => {
    const result = formatPublicResultTime(timestamp, "Asia/Kuala_Lumpur");

    expect(result.localTime).toBe("19 Aug 2026 • 6:21:16 PM");
    expect(result.timezoneLabel).toBe("Malaysia Time (MYT)");
    expect(result.utcTime).toBe("10:21:16 UTC");
  });

  it("formats India local time from the same instant", () => {
    const result = formatPublicResultTime(timestamp, "Asia/Kolkata");

    expect(result.localTime).toBe("19 Aug 2026 • 3:51:16 PM");
    expect(result.timezoneLabel).toBe("India Time (IST)");
    expect(result.utcTime).toBe("10:21:16 UTC");
  });

  it("handles UK daylight saving automatically", () => {
    const summer = formatPublicResultTime("2026-08-19T10:21:16.000Z", "Europe/London");
    const winter = formatPublicResultTime("2026-01-19T10:21:16.000Z", "Europe/London");

    expect(summer.localTime).toBe("19 Aug 2026 • 11:21:16 AM");
    expect(summer.timezoneLabel).toBe("UK Time (BST)");
    expect(winter.localTime).toBe("19 Jan 2026 • 10:21:16 AM");
    expect(winter.timezoneLabel).toBe("UK Time (GMT)");
  });

  it("handles US daylight saving automatically", () => {
    const summer = formatPublicResultTime("2026-08-19T10:21:16.000Z", "America/New_York");
    const winter = formatPublicResultTime("2026-01-19T10:21:16.000Z", "America/New_York");

    expect(summer.localTime).toBe("19 Aug 2026 • 6:21:16 AM");
    expect(summer.timezoneLabel).toBe("Eastern Time (EDT)");
    expect(winter.localTime).toBe("19 Jan 2026 • 5:21:16 AM");
    expect(winter.timezoneLabel).toBe("Eastern Time (EST)");
  });

  it("falls back to UTC without guessing when timezone is unavailable or invalid", () => {
    expect(formatPublicResultTime(timestamp, null)).toEqual({
      localTime: null,
      timezoneLabel: null,
      utcTime: "10:21:16 UTC"
    });
    expect(formatPublicResultTime(timestamp, "Not/AZone")).toEqual({
      localTime: null,
      timezoneLabel: null,
      utcTime: "10:21:16 UTC"
    });
  });

  it("detects browser timezone without geolocation", () => {
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () => ({ timeZone: "Asia/Kuala_Lumpur" })
    } as Intl.DateTimeFormat);

    expect(getBrowserTimezone()).toBe("Asia/Kuala_Lumpur");
    spy.mockRestore();
  });
});
