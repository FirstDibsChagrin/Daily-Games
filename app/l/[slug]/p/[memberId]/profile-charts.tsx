"use client";

import { useTheme } from "next-themes";
import { useMemo, useState } from "react";
import {
  Bar,
  Cell,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GameDot } from "@/components/league/bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/select";
import type { Direction, InputType } from "@/lib/catalog-data";
import { formatShort, formatWeek } from "@/lib/dates";
import { formatValue } from "@/lib/score-values";

export interface ChartGame {
  id: string;
  name: string;
  color: string;
  inputType: InputType;
  min: number;
  direction: Direction;
  points: { date: string; value: number | null; failed: boolean }[];
}

// Single-series charts use the accent; per-mode steps so both themes keep contrast.
const THEME = {
  dark: {
    accent: "#c6ef3a",
    grid: "#2d2d27",
    text: "#a6a497",
    surface: "#191915",
    gold: "#e9c54a",
  },
  light: {
    accent: "#46640a",
    grid: "#d8d4c4",
    text: "#5a584d",
    surface: "#fbfaf4",
    gold: "#7d5e00",
  },
};

function useChartTheme() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "light" ? THEME.light : THEME.dark;
}

function TooltipBox({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="bg-card rounded-md border px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold">{title}</p>
      {lines.map((l) => (
        <p key={l} className="num text-muted-foreground">
          {l}
        </p>
      ))}
    </div>
  );
}

/** Histogram bins: one per value for small integer spreads, otherwise ~8 equal bins. Fails get their own bin. */
function histogram(g: ChartGame) {
  const vals = g.points.filter((p) => !p.failed && p.value !== null).map((p) => p.value!);
  const fails = g.points.length - vals.length;
  const bins: { label: string; count: number }[] = [];
  if (vals.length) {
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const fmt = (v: number) => formatValue({ input_type: g.inputType, min: g.min }, v, false);
    if (g.inputType === "integer" && hi - lo <= 15) {
      for (let v = lo; v <= hi; v++)
        bins.push({ label: fmt(v), count: vals.filter((x) => x === v).length });
    } else if (lo === hi) {
      bins.push({ label: fmt(lo), count: vals.length });
    } else {
      const n = 8;
      const step = (hi - lo) / n;
      for (let i = 0; i < n; i++) {
        const a = lo + i * step;
        const b = i === n - 1 ? hi : lo + (i + 1) * step;
        const count = vals.filter((x) => (i === n - 1 ? x >= a && x <= b : x >= a && x < b)).length;
        const r = (v: number) =>
          g.inputType === "decimal" ? Math.round(v * 10) / 10 : Math.round(v);
        bins.push({ label: `${fmt(r(a))}–${fmt(r(b))}`, count });
      }
    }
  }
  if (fails) bins.push({ label: "X", count: fails });
  return bins;
}

export function ProfileCharts({
  games,
  weeklyPoints,
  currentWeek,
}: {
  games: ChartGame[];
  weeklyPoints: { week: string; points: number; champion: boolean }[];
  currentWeek: string;
}) {
  const t = useChartTheme();
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const game = games.find((g) => g.id === gameId) ?? games[0];
  const fmt = (v: number) =>
    game ? formatValue({ input_type: game.inputType, min: game.min }, v, false) : String(v);
  const trend = useMemo(
    () =>
      game
        ? game.points.filter((p) => !p.failed).map((p) => ({ date: p.date, value: p.value }))
        : [],
    [game],
  );
  const bins = useMemo(() => (game ? histogram(game) : []), [game]);
  const weeks = weeklyPoints.slice(-16);
  const axis = { stroke: t.grid, tick: { fill: t.text, fontSize: 11 }, tickLine: false };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {game && (
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GameDot color={game.color} /> Score trend
              </CardTitle>
              <CardDescription>
                {game.direction === "lower_is_better"
                  ? "Lower is better — the axis is flipped so up means better."
                  : "Higher is better."}
              </CardDescription>
            </div>
            <NativeSelect
              aria-label="Choose a game for the charts"
              value={game.id}
              onChange={(e) => setGameId(e.target.value)}
              className="w-48"
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </NativeSelect>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <figure>
              <figcaption className="mb-2 text-sm font-medium">Scores over time</figcaption>
              <div
                className="h-56"
                role="img"
                aria-label={`${game.name} scores over time, ${trend.length} entries`}
              >
                {trend.length < 2 ? (
                  <p className="text-muted-foreground flex h-full items-center justify-center text-sm">
                    Play a few more days to see a trend.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                      <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={formatShort} minTickGap={24} {...axis} />
                      <YAxis
                        reversed={game.direction === "lower_is_better"}
                        tickFormatter={fmt}
                        width={48}
                        domain={["auto", "auto"]}
                        axisLine={false}
                        {...axis}
                      />
                      <Tooltip
                        cursor={{ stroke: t.text, strokeDasharray: "3 3" }}
                        content={({ active, payload }) =>
                          active && payload?.[0] ? (
                            <TooltipBox
                              title={formatShort(String(payload[0].payload.date))}
                              lines={[fmt(Number(payload[0].value))]}
                            />
                          ) : null
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={t.accent}
                        strokeWidth={2}
                        dot={
                          trend.length <= 30
                            ? { r: 3, fill: t.accent, stroke: t.surface, strokeWidth: 2 }
                            : false
                        }
                        activeDot={{ r: 5, fill: t.accent, stroke: t.surface, strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </figure>
            <figure>
              <figcaption className="mb-2 text-sm font-medium">Score distribution</figcaption>
              <div className="h-56" role="img" aria-label={`${game.name} score distribution`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={bins}
                    margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
                    barCategoryGap={2}
                  >
                    <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="label" interval="preserveStartEnd" {...axis} />
                    <YAxis allowDecimals={false} width={40} axisLine={false} {...axis} />
                    <Tooltip
                      cursor={{ fill: t.grid, opacity: 0.4 }}
                      content={({ active, payload }) =>
                        active && payload?.[0] ? (
                          <TooltipBox
                            title={String(payload[0].payload.label)}
                            lines={[
                              `${payload[0].value} ${Number(payload[0].value) === 1 ? "time" : "times"}`,
                            ]}
                          />
                        ) : null
                      }
                    />
                    <Bar
                      dataKey="count"
                      fill={t.accent}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </figure>
          </CardContent>
        </Card>
      )}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Points per week</CardTitle>
          <CardDescription>
            {weeks.length === 1 ? "This week so far." : `Last ${weeks.length} weeks.`} Gold bars
            marked “1st” are weeks you won.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-52" role="img" aria-label="Points per week">
            {weeks.length === 0 ? (
              <p className="text-muted-foreground flex h-full items-center justify-center text-sm">
                No points yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeks}
                  margin={{ top: 16, right: 8, bottom: 0, left: -20 }}
                  barCategoryGap={2}
                >
                  <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="week" tickFormatter={formatShort} minTickGap={16} {...axis} />
                  <YAxis allowDecimals={false} width={40} axisLine={false} {...axis} />
                  <Tooltip
                    cursor={{ fill: t.grid, opacity: 0.4 }}
                    content={({ active, payload }) =>
                      active && payload?.[0] ? (
                        <TooltipBox
                          title={`${formatWeek(String(payload[0].payload.week))}${payload[0].payload.week === currentWeek ? " (so far)" : ""}`}
                          lines={[
                            `${payload[0].value} pts${payload[0].payload.champion ? " · weekly champion" : ""}`,
                          ]}
                        />
                      ) : null
                    }
                  />
                  <Bar
                    dataKey="points"
                    fill={t.accent}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    isAnimationActive={false}
                    label={({
                      x,
                      y,
                      width,
                      index,
                    }: {
                      x?: number | string;
                      y?: number | string;
                      width?: number | string;
                      index?: number;
                    }) =>
                      index !== undefined && weeks[index]?.champion ? (
                        <text
                          x={Number(x) + Number(width) / 2}
                          y={Number(y) - 4}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight={700}
                          fill={t.gold}
                        >
                          1st
                        </text>
                      ) : (
                        <g />
                      )
                    }
                  >
                    {weeks.map((w) => (
                      <Cell key={w.week} fill={w.champion ? t.gold : t.accent} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
