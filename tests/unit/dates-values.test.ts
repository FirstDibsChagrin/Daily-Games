import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  formatWeek,
  gameDayOf,
  isPlainDate,
  monthEnd,
  periodFor,
  shiftPeriod,
  weekEnd,
  weekStart,
} from "@/lib/dates";
import {
  formatTime,
  formatValue,
  parseScoreInput,
  parseTime,
  validateValue,
} from "@/lib/score-values";

describe("game day (America/New_York)", () => {
  it("rolls over at midnight Eastern, not UTC", () => {
    // 11:59 PM EST on Nov 13 = 04:59 UTC Nov 14
    expect(gameDayOf(new Date("2026-11-14T04:59:00Z"))).toBe("2026-11-13");
    expect(gameDayOf(new Date("2026-11-14T05:00:00Z"))).toBe("2026-11-14");
  });

  it("uses EDT (UTC-4) in summer", () => {
    expect(gameDayOf(new Date("2026-07-04T03:59:59Z"))).toBe("2026-07-03");
    expect(gameDayOf(new Date("2026-07-04T04:00:00Z"))).toBe("2026-07-04");
  });

  it("handles the spring-forward day (Mar 8, 2026)", () => {
    // Midnight EST Mar 8 = 05:00Z; clocks jump at 2am EST (07:00Z) to 3am EDT
    expect(gameDayOf(new Date("2026-03-08T04:59:59Z"))).toBe("2026-03-07");
    expect(gameDayOf(new Date("2026-03-08T05:00:00Z"))).toBe("2026-03-08");
    // Midnight EDT Mar 9 = 04:00Z
    expect(gameDayOf(new Date("2026-03-09T03:59:59Z"))).toBe("2026-03-08");
    expect(gameDayOf(new Date("2026-03-09T04:00:00Z"))).toBe("2026-03-09");
  });

  it("handles the fall-back day (Nov 1, 2026)", () => {
    // Midnight EDT Nov 1 = 04:00Z; the 1am hour repeats; midnight EST Nov 2 = 05:00Z
    expect(gameDayOf(new Date("2026-11-01T03:59:59Z"))).toBe("2026-10-31");
    expect(gameDayOf(new Date("2026-11-01T04:00:00Z"))).toBe("2026-11-01");
    expect(gameDayOf(new Date("2026-11-01T06:30:00Z"))).toBe("2026-11-01"); // repeated 1:30am
    expect(gameDayOf(new Date("2026-11-02T04:59:59Z"))).toBe("2026-11-01");
    expect(gameDayOf(new Date("2026-11-02T05:00:00Z"))).toBe("2026-11-02");
  });

  it("handles New Year's Eve", () => {
    expect(gameDayOf(new Date("2027-01-01T04:59:59Z"))).toBe("2026-12-31");
    expect(gameDayOf(new Date("2027-01-01T05:00:00Z"))).toBe("2027-01-01");
  });
});

describe("plain-date arithmetic", () => {
  it("weeks run Monday to Sunday", () => {
    expect(weekStart("2026-11-13")).toBe("2026-11-09"); // Fri -> Mon
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
    expect(weekStart("2026-11-15")).toBe("2026-11-09"); // Sun -> Mon before
    expect(weekEnd("2026-11-13")).toBe("2026-11-15");
  });

  it("weeks across DST changes still have 7 days", () => {
    // Week containing spring-forward (Sun Mar 8, 2026)
    expect(weekStart("2026-03-08")).toBe("2026-03-02");
    expect(weekEnd("2026-03-02")).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    // Week containing fall-back (Sun Nov 1, 2026)
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  });

  it("weeks across year boundaries", () => {
    expect(weekStart("2027-01-01")).toBe("2026-12-28"); // Fri Jan 1 2027
    expect(weekEnd("2026-12-28")).toBe("2027-01-03");
    expect(formatWeek("2026-12-28")).toBe("Dec 28 – Jan 3, 2027");
    expect(weekStart("2026-01-01")).toBe("2025-12-29");
  });

  it("months", () => {
    expect(monthEnd("2028-02-10")).toBe("2028-02-29");
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
  });

  it("periods and navigation", () => {
    const w = periodFor("week", "2026-11-13");
    expect(w).toMatchObject({ start: "2026-11-09", end: "2026-11-15" });
    expect(shiftPeriod(w, -1)).toMatchObject({ start: "2026-11-02", end: "2026-11-08" });
    const m = periodFor("month", "2026-12-15");
    expect(shiftPeriod(m, 1)).toMatchObject({ start: "2027-01-01", end: "2027-01-31" });
    expect(shiftPeriod(periodFor("day", "2026-12-31"), 1).start).toBe("2027-01-01");
  });

  it("validates plain dates", () => {
    expect(isPlainDate("2026-11-13")).toBe(true);
    expect(isPlainDate("2026-02-30")).toBe(false);
    expect(isPlainDate("2026-1-3")).toBe(false);
    expect(isPlainDate(42)).toBe(false);
  });
});

describe("score values", () => {
  const time = { input_type: "time" as const, min: 0, max: 3600, allow_fail: true };
  const int = { input_type: "integer" as const, min: 1, max: 6, allow_fail: true };
  const golf = { input_type: "integer" as const, min: -10, max: 50, allow_fail: true };
  const dec = { input_type: "decimal" as const, min: 0, max: 14, allow_fail: false };

  it("parses m:ss and h:mm:ss", () => {
    expect(parseTime("2:35")).toBe(155);
    expect(parseTime("0:07")).toBe(7);
    expect(parseTime("12:00")).toBe(720);
    expect(parseTime("1:02:03")).toBe(3723);
    expect(parseTime("95")).toBe(95);
    expect(parseTime("2:75")).toBeNull();
    expect(parseTime("1:60:00")).toBeNull();
    expect(parseTime("abc")).toBeNull();
  });

  it("formats seconds as m:ss", () => {
    expect(formatTime(155)).toBe("2:35");
    expect(formatTime(7)).toBe("0:07");
    expect(formatTime(3723)).toBe("1:02:03");
  });

  it("time games accept m:ss within range", () => {
    expect(parseScoreInput(time, "2:35")).toEqual({ ok: true, value: 155 });
    expect(parseScoreInput(time, "61:00")).toMatchObject({ ok: false });
    expect(parseScoreInput(time, "2.35")).toMatchObject({ ok: false });
  });

  it("integer games validate range and type", () => {
    expect(parseScoreInput(int, "4")).toEqual({ ok: true, value: 4 });
    expect(parseScoreInput(int, "7")).toEqual({ ok: false, error: "Must be between 1 and 6." });
    expect(parseScoreInput(int, "3.5")).toMatchObject({ ok: false });
    expect(parseScoreInput(int, "")).toMatchObject({ ok: false });
  });

  it("golf-style games accept a leading + or -", () => {
    expect(parseScoreInput(golf, "+2")).toEqual({ ok: true, value: 2 });
    expect(parseScoreInput(golf, "-1")).toEqual({ ok: true, value: -1 });
    expect(parseScoreInput(golf, "−3")).toEqual({ ok: true, value: -3 });
    expect(formatValue(golf, 2, false)).toBe("+2");
    expect(formatValue(golf, 0, false)).toBe("0");
  });

  it("decimal games", () => {
    expect(parseScoreInput(dec, "9.4")).toEqual({ ok: true, value: 9.4 });
    expect(parseScoreInput(dec, "14.1")).toMatchObject({ ok: false });
    expect(parseScoreInput(dec, "1.2345")).toMatchObject({ ok: false });
  });

  it("server validation enforces X only where allowed", () => {
    expect(validateValue(int, null, true)).toBeNull();
    expect(validateValue(dec, null, true)).toMatch(/doesn't allow/);
    expect(validateValue(int, 3.5, false)).toMatch(/whole/);
    expect(validateValue(int, 9, false)).toMatch(/between/);
    expect(formatValue(int, null, true)).toBe("X");
    expect(formatValue(time, 155, false)).toBe("2:35");
  });
});
