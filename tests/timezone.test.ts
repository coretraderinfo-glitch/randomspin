import { describe, expect, it } from "vitest";
import { startOfZonedDay, startOfZonedMonth, startOfZonedWeek } from "@/lib/timezone";

describe("timezone reporting boundaries", () => {
  it("uses Malaysia midnight for 23:30 Malaysia", () => {
    const now = new Date("2026-08-18T15:30:00.000Z");
    expect(startOfZonedDay(now, "Asia/Kuala_Lumpur").toISOString()).toBe("2026-08-17T16:00:00.000Z");
  });

  it("uses Malaysia midnight for 00:30 Malaysia after UTC date rollover", () => {
    const now = new Date("2026-08-18T16:30:00.000Z");
    expect(startOfZonedDay(now, "Asia/Kuala_Lumpur").toISOString()).toBe("2026-08-18T16:00:00.000Z");
  });

  it("handles Malaysia month rollover", () => {
    const now = new Date("2026-08-31T16:30:00.000Z");
    expect(startOfZonedMonth(now, "Asia/Kuala_Lumpur").toISOString()).toBe("2026-08-31T16:00:00.000Z");
  });

  it("handles Malaysia year rollover", () => {
    const now = new Date("2026-12-31T16:30:00.000Z");
    expect(startOfZonedDay(now, "Asia/Kuala_Lumpur").toISOString()).toBe("2026-12-31T16:00:00.000Z");
    expect(startOfZonedMonth(now, "Asia/Kuala_Lumpur").toISOString()).toBe("2026-12-31T16:00:00.000Z");
  });

  it("starts reporting weeks on Monday in the configured timezone", () => {
    const now = new Date("2026-08-19T06:00:00.000Z");
    expect(startOfZonedWeek(now, "Asia/Kuala_Lumpur").toISOString()).toBe("2026-08-16T16:00:00.000Z");
  });
});
