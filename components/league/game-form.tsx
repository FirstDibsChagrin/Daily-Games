"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { FormError } from "@/components/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Direction, InputType } from "@/lib/catalog-data";
import { formatTime, parseTime } from "@/lib/score-values";
import { cn } from "@/lib/utils";
import type { GameFields } from "@/lib/validation";

export const SWATCHES = [
  "#22c55e",
  "#a855f7",
  "#f97316",
  "#ef4444",
  "#38bdf8",
  "#3b82f6",
  "#d97706",
  "#ec4899",
  "#14b8a6",
  "#eab308",
  "#84cc16",
  "#e2c08d",
  "#06b6d4",
  "#f59e0b",
  "#f43f5e",
  "#94a3b8",
];

export interface GameFormValues {
  name: string;
  entry_prompt: string;
  entry_example: string;
  input_type: InputType;
  min: number;
  max: number;
  direction: Direction;
  allow_fail: boolean;
  color: string;
  url: string | null;
  unit_label: string | null;
}

export const BLANK_GAME: GameFormValues = {
  name: "",
  entry_prompt: "",
  entry_example: "",
  input_type: "integer",
  min: 0,
  max: 100,
  direction: "higher_is_better",
  allow_fail: false,
  color: "#8b5cf6",
  url: null,
  unit_label: null,
};

function boundToText(type: InputType, v: number) {
  return type === "time" ? formatTime(v) : String(v);
}

export function GameForm({
  initial,
  submitLabel,
  hasScores = false,
  onSubmit,
  onCancel,
  idPrefix,
}: {
  initial: GameFormValues;
  submitLabel: string;
  hasScores?: boolean;
  onSubmit: (fields: GameFields) => Promise<string | null>;
  onCancel?: () => void;
  idPrefix: string;
}) {
  const [v, setV] = useState({
    ...initial,
    url: initial.url ?? "",
    unit_label: initial.unit_label ?? "",
    minText: boundToText(initial.input_type, initial.min),
    maxText: boundToText(initial.input_type, initial.max),
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) =>
    setV((s) => ({ ...s, [k]: val }));
  const id = (s: string) => `${idPrefix}-${s}`;

  const parseBound = (t: string) =>
    v.input_type === "time" ? parseTime(t) : t.trim() === "" ? NaN : Number(t);
  const min = parseBound(v.minText);
  const max = parseBound(v.maxText);
  const scoringChanged =
    hasScores &&
    (v.direction !== initial.direction ||
      min !== initial.min ||
      max !== initial.max ||
      v.input_type !== initial.input_type ||
      v.allow_fail !== initial.allow_fail);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (min === null || max === null || Number.isNaN(min) || Number.isNaN(max)) {
          return setError(
            v.input_type === "time" ? "Use m:ss for min and max." : "Min and max must be numbers.",
          );
        }
        setPending(true);
        const err = await onSubmit({
          name: v.name,
          entry_prompt: v.entry_prompt,
          entry_example: v.entry_example,
          input_type: v.input_type,
          min,
          max,
          direction: v.direction,
          allow_fail: v.allow_fail,
          color: v.color,
          url: v.url,
          unit_label: v.unit_label,
        });
        setPending(false);
        if (err) setError(err);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={id("name")}>Name</Label>
          <Input
            id={id("name")}
            required
            maxLength={40}
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("url")}>Link (optional)</Label>
          <Input
            id={id("url")}
            type="url"
            inputMode="url"
            placeholder="https://"
            value={v.url}
            onChange={(e) => set("url", e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={id("prompt")}>Entry instructions (shown to players)</Label>
        <Textarea
          id={id("prompt")}
          required
          maxLength={300}
          rows={2}
          value={v.entry_prompt}
          onChange={(e) => set("entry_prompt", e.target.value)}
          placeholder="Enter your total points from the end screen."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor={id("example")}>Example</Label>
          <Input
            id={id("example")}
            maxLength={60}
            value={v.entry_example}
            onChange={(e) => set("entry_example", e.target.value)}
            placeholder="e.g. 540"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("type")}>Input type</Label>
          <NativeSelect
            id={id("type")}
            value={v.input_type}
            onChange={(e) => {
              const t = e.target.value as InputType;
              setV((s) => ({
                ...s,
                input_type: t,
                minText: t === "time" ? "0:00" : s.input_type === "time" ? "0" : s.minText,
                maxText: t === "time" ? "60:00" : s.input_type === "time" ? "100" : s.maxText,
              }));
            }}
          >
            <option value="integer">Whole number</option>
            <option value="decimal">Decimal number</option>
            <option value="time">Time (m:ss)</option>
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("unit")}>Unit label (optional)</Label>
          <Input
            id={id("unit")}
            maxLength={12}
            value={v.unit_label}
            onChange={(e) => set("unit_label", e.target.value)}
            placeholder="pts"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor={id("min")}>Min{v.input_type === "time" ? " (m:ss)" : ""}</Label>
          <Input
            id={id("min")}
            required
            value={v.minText}
            onChange={(e) => set("minText", e.target.value)}
            className="num"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("max")}>Max{v.input_type === "time" ? " (m:ss)" : ""}</Label>
          <Input
            id={id("max")}
            required
            value={v.maxText}
            onChange={(e) => set("maxText", e.target.value)}
            className="num"
          />
        </div>
        <div className="col-span-2 grid gap-2 sm:col-span-1">
          <Label htmlFor={id("dir")}>Who wins?</Label>
          <NativeSelect
            id={id("dir")}
            value={v.direction}
            onChange={(e) => set("direction", e.target.value as Direction)}
          >
            <option value="higher_is_better">Higher is better</option>
            <option value="lower_is_better">Lower is better</option>
          </NativeSelect>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <div>
          <Label htmlFor={id("fail")}>Allow “X / didn&apos;t finish”</Label>
          <p className="text-muted-foreground mt-1 text-xs">
            Shows an X button. X ranks last and gets the minimum points.
          </p>
        </div>
        <Switch
          id={id("fail")}
          checked={v.allow_fail}
          onCheckedChange={(c) => set("allow_fail", c)}
        />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Color</legend>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set("color", c)}
              aria-label={`Color ${c}`}
              aria-pressed={v.color.toLowerCase() === c}
              className={cn(
                "ring-offset-card size-7 cursor-pointer rounded-full ring-offset-2 transition-transform hover:scale-110",
                v.color.toLowerCase() === c && "ring-foreground ring-2",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="text-muted-foreground flex items-center gap-1 text-xs">
            <input
              type="color"
              value={v.color}
              onChange={(e) => set("color", e.target.value)}
              className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
              aria-label="Custom color"
            />
            Custom
          </label>
        </div>
      </fieldset>
      {scoringChanged && (
        <p className="border-warning/40 bg-warning/10 text-warning flex items-start gap-2 rounded-lg border p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          This game already has scores. Changing how it&apos;s scored will recalculate every past
          result and standing. Existing scores outside the new range are kept as-is.
        </p>
      )}
      <FormError message={error} />
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
