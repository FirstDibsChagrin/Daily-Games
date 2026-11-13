// Parsing, validating and formatting raw score values. Pure and shared by client and server.
import type { Direction, InputType } from "./catalog-data";

export interface GameRules {
  input_type: InputType;
  min: number;
  max: number;
  allow_fail: boolean;
  direction?: Direction;
  unit_label?: string | null;
}

/** Parses "m:ss", "mm:ss" or "h:mm:ss" (also a bare number of seconds) into seconds. */
export function parseTime(raw: string): number | null {
  const s = raw.trim();
  if (/^\d+$/.test(s)) return Number(s);
  const m = /^(?:(\d+):)?(\d{1,3}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const sec = Number(m[3]);
  if (sec >= 60) return null;
  if (m[1] !== undefined && min >= 60) return null;
  return h * 3600 + min * 60 + sec;
}

/** Seconds to "m:ss" (or "h:mm:ss" past an hour). */
export function formatTime(totalSeconds: number): string {
  const t = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

function describeBound(rules: GameRules, v: number): string {
  return rules.input_type === "time" ? formatTime(v) : String(v);
}

/** Parses and validates what a player typed for a game. */
export function parseScoreInput(rules: GameRules, raw: string): ParseResult {
  const s = raw.trim().replace(/,/g, "").replace(/^−/, "-");
  if (s === "") return { ok: false, error: "Enter a score." };
  let value: number;
  if (rules.input_type === "time") {
    const t = parseTime(s);
    if (t === null) return { ok: false, error: "Use minutes:seconds, like 2:35." };
    value = t;
  } else if (rules.input_type === "integer") {
    if (!/^[+-]?\d+$/.test(s)) return { ok: false, error: "Enter a whole number." };
    value = Number(s);
  } else {
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return { ok: false, error: "Enter a number." };
    value = Number(s);
    if (Math.abs(value * 1000 - Math.round(value * 1000)) > 1e-6)
      return { ok: false, error: "Use at most 3 decimal places." };
  }
  if (!Number.isFinite(value)) return { ok: false, error: "Enter a number." };
  if (value < rules.min || value > rules.max) {
    return {
      ok: false,
      error: `Must be between ${describeBound(rules, rules.min)} and ${describeBound(rules, rules.max)}.`,
    };
  }
  return { ok: true, value };
}

/** Validates a value that is already numeric (server side). */
export function validateValue(
  rules: GameRules,
  value: number | null,
  failed: boolean,
): string | null {
  if (failed) {
    if (!rules.allow_fail) return "This game doesn't allow an X.";
    if (value !== null) return "A failed entry can't have a value.";
    return null;
  }
  if (value === null || !Number.isFinite(value)) return "Enter a score.";
  if (rules.input_type !== "decimal" && !Number.isInteger(value)) return "Enter a whole number.";
  if (value < rules.min || value > rules.max) {
    return `Must be between ${describeBound(rules, rules.min)} and ${describeBound(rules, rules.max)}.`;
  }
  return null;
}

/** Display a stored value. Integer games with negative minimums (golf style) show a sign. */
export function formatValue(
  rules: Pick<GameRules, "input_type" | "min">,
  value: number | null,
  failed: boolean,
): string {
  if (failed || value === null) return "X";
  if (rules.input_type === "time") return formatTime(value);
  if (rules.min < 0 && value > 0) return `+${value}`;
  if (rules.input_type === "decimal") return String(Number(value.toFixed(3)));
  return String(value);
}

/** Value as it should appear in an input box for editing. */
export function valueToInput(
  rules: Pick<GameRules, "input_type" | "min">,
  value: number | null,
): string {
  if (value === null) return "";
  if (rules.input_type === "time") return formatTime(value);
  return String(value);
}
