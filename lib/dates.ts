// Pure date helpers. A "game day" is a plain calendar date string (YYYY-MM-DD)
// in America/New_York. Only `gameDayOf` needs a time zone; everything else is
// plain-date arithmetic done in UTC, so DST can never shift a day.
import { formatInTimeZone } from "date-fns-tz";

export const LEAGUE_TZ = "America/New_York";
export type PlainDate = string; // "YYYY-MM-DD"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The game day (America/New_York calendar date) at the given instant. */
export function gameDayOf(instant: Date): PlainDate {
  return formatInTimeZone(instant, LEAGUE_TZ, "yyyy-MM-dd");
}

export function isPlainDate(s: unknown): s is PlainDate {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = toUtc(s);
  return !Number.isNaN(d.getTime()) && fromUtc(d) === s;
}

function toUtc(d: PlainDate): Date {
  return new Date(`${d}T00:00:00Z`);
}
function fromUtc(d: Date): PlainDate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: PlainDate, n: number): PlainDate {
  const t = toUtc(d);
  t.setUTCDate(t.getUTCDate() + n);
  return fromUtc(t);
}

export function addMonths(d: PlainDate, n: number): PlainDate {
  const t = toUtc(d);
  const day = t.getUTCDate();
  t.setUTCDate(1);
  t.setUTCMonth(t.getUTCMonth() + n);
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return fromUtc(t);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: PlainDate, b: PlainDate): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(d: PlainDate): number {
  return (toUtc(d).getUTCDay() + 6) % 7;
}

/** Monday of the week containing d (weeks run Monday to Sunday). */
export function weekStart(d: PlainDate): PlainDate {
  return addDays(d, -weekdayIndex(d));
}
export function weekEnd(d: PlainDate): PlainDate {
  return addDays(weekStart(d), 6);
}
export function monthStart(d: PlainDate): PlainDate {
  return `${d.slice(0, 7)}-01`;
}
export function monthEnd(d: PlainDate): PlainDate {
  const t = toUtc(monthStart(d));
  return fromUtc(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)));
}

/** Inclusive list of dates from a to b. */
export function dateRange(a: PlainDate, b: PlainDate): PlainDate[] {
  const out: PlainDate[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d);
  return out;
}

export type PeriodKind = "day" | "week" | "month" | "all";
export const PERIOD_KINDS: PeriodKind[] = ["day", "week", "month", "all"];

export interface Period {
  kind: PeriodKind;
  start: PlainDate | null; // null = unbounded (all-time)
  end: PlainDate | null;
  anchor: PlainDate;
}

export function periodFor(kind: PeriodKind, anchor: PlainDate): Period {
  switch (kind) {
    case "day":
      return { kind, start: anchor, end: anchor, anchor };
    case "week":
      return { kind, start: weekStart(anchor), end: weekEnd(anchor), anchor: weekStart(anchor) };
    case "month":
      return { kind, start: monthStart(anchor), end: monthEnd(anchor), anchor: monthStart(anchor) };
    case "all":
      return { kind, start: null, end: null, anchor };
  }
}

export function shiftPeriod(p: Period, dir: 1 | -1): Period {
  switch (p.kind) {
    case "day":
      return periodFor("day", addDays(p.anchor, dir));
    case "week":
      return periodFor("week", addDays(p.anchor, 7 * dir));
    case "month":
      return periodFor("month", addMonths(p.anchor, dir));
    case "all":
      return p;
  }
}

/** True when the period contains `today` (it is the "current" one). */
export function isCurrentPeriod(p: Period, today: PlainDate): boolean {
  if (p.kind === "all") return true;
  return p.start! <= today && today <= p.end!;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parts(d: PlainDate) {
  return { y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)), day: Number(d.slice(8, 10)) };
}

/** "Mon, Nov 10" */
export function formatDay(d: PlainDate, opts: { year?: boolean } = {}): string {
  const { y, m, day } = parts(d);
  return `${DOW[weekdayIndex(d)]}, ${MONTHS[m - 1]} ${day}${opts.year ? `, ${y}` : ""}`;
}
/** "Nov 10" */
export function formatShort(d: PlainDate): string {
  const { m, day } = parts(d);
  return `${MONTHS[m - 1]} ${day}`;
}
export function weekdayShort(d: PlainDate): string {
  return DOW[weekdayIndex(d)];
}
/** "Nov 10 – 16, 2026" or "Dec 29 – Jan 4, 2027" */
export function formatWeek(start: PlainDate): string {
  const end = addDays(start, 6);
  const a = parts(start);
  const b = parts(end);
  if (a.m === b.m) return `${MONTHS[a.m - 1]} ${a.day} – ${b.day}, ${b.y}`;
  return `${MONTHS[a.m - 1]} ${a.day} – ${MONTHS[b.m - 1]} ${b.day}, ${b.y}`;
}
export function formatMonth(d: PlainDate): string {
  const { y, m } = parts(d);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function periodLabel(p: Period, today: PlainDate): string {
  switch (p.kind) {
    case "day":
      if (p.anchor === today) return "Today";
      if (p.anchor === addDays(today, -1)) return "Yesterday";
      return formatDay(p.anchor, { year: p.anchor.slice(0, 4) !== today.slice(0, 4) });
    case "week":
      return weekStart(today) === p.anchor ? "This week" : formatWeek(p.anchor);
    case "month":
      return formatMonth(p.anchor);
    case "all":
      return "All-time";
  }
}
