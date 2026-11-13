"use client";

import { CalendarClock, Check, ExternalLink, Hourglass, Loader2, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteScore, saveScores } from "@/app/actions/scores";
import { FormError } from "@/components/form-bits";
import { GameDot, RankBadge } from "@/components/league/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Direction, InputType } from "@/lib/catalog-data";
import { celebrate } from "@/lib/confetti";
import { addDays, formatDay, weekdayShort, type PlainDate } from "@/lib/dates";
import { formatValue, parseScoreInput, valueToInput } from "@/lib/score-values";
import type { GameDayStatus } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export interface TodayGame {
  id: string;
  name: string;
  color: string;
  url: string | null;
  entry_prompt: string;
  entry_example: string;
  input_type: InputType;
  min: number;
  max: number;
  direction: Direction;
  allow_fail: boolean;
  unit_label: string | null;
  mine: { value: number | null; failed: boolean } | null;
  status: GameDayStatus;
  entries: {
    memberId: string;
    name: string;
    value: number | null;
    failed: boolean;
    rank: number | null;
    points: number;
    isWinner: boolean;
  }[];
}

/** Auto-inserts the colon for time games so a numeric keypad is enough ("235" -> "2:35"). */
function formatTimeTyping(raw: string): string {
  if (/[^\d:]/.test(raw) || raw.includes(":")) return raw.replace(/[^\d:]/g, "");
  const d = raw
    .replace(/\D/g, "")
    .replace(/^0+(?=\d{3})/, "")
    .slice(0, 6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, -2)}:${d.slice(-2)}`;
  return `${d.slice(0, -4)}:${d.slice(-4, -2)}:${d.slice(-2)}`;
}

function inputModeFor(g: TodayGame): React.HTMLAttributes<HTMLInputElement>["inputMode"] {
  if (g.input_type === "decimal") return "decimal";
  if (g.input_type === "integer" && g.min < 0) return "text";
  return "numeric";
}

export function TodayBoard({
  slug,
  date,
  today,
  meId,
  games,
}: {
  slug: string;
  date: PlainDate;
  today: PlainDate;
  meId: string;
  games: TodayGame[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [savingAll, startSaveAll] = useTransition();
  const [navigating, startNav] = useTransition();
  // Reset drafts when switching days.
  const [draftDate, setDraftDate] = useState(date);
  if (draftDate !== date) {
    setDraftDate(date);
    setDrafts({});
    setErrors({});
  }

  const savedInput = (g: TodayGame) =>
    g.mine && !g.mine.failed ? valueToInput(g, g.mine.value) : "";
  const draftOf = (g: TodayGame) => drafts[g.id] ?? savedInput(g);
  const isDirty = (g: TodayGame) =>
    drafts[g.id] !== undefined && drafts[g.id].trim() !== savedInput(g);
  const dirtyGames = games.filter(isDirty);

  const wasWinner = (g: TodayGame) => g.entries.some((e) => e.memberId === meId && e.isWinner);

  async function submit(entries: { game: TodayGame; failed: boolean }[]) {
    // Client-side validation first, with friendly messages.
    const toSend: { gameId: string; raw?: string; failed: boolean }[] = [];
    const nextErrors: Record<string, string | undefined> = {};
    for (const { game, failed } of entries) {
      if (failed) {
        toSend.push({ gameId: game.id, failed: true });
        continue;
      }
      const p = parseScoreInput(game, draftOf(game));
      if (!p.ok) nextErrors[game.id] = p.error;
      else toSend.push({ gameId: game.id, raw: draftOf(game), failed: false });
    }
    setErrors((e) => ({
      ...e,
      ...Object.fromEntries(entries.map(({ game }) => [game.id, nextErrors[game.id]])),
    }));
    if (toSend.length === 0) return;
    setBusy((b) => ({ ...b, ...Object.fromEntries(toSend.map((e) => [e.gameId, true])) }));
    const res = await saveScores({ slug, date, entries: toSend });
    setBusy((b) => ({ ...b, ...Object.fromEntries(toSend.map((e) => [e.gameId, false])) }));
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const okIds = res.results.filter((r) => r.ok).map((r) => r.gameId);
    setErrors((e) => ({
      ...e,
      ...Object.fromEntries(res.results.map((r) => [r.gameId, r.ok ? undefined : r.error])),
    }));
    setDrafts((d) => {
      const copy = { ...d };
      for (const id of okIds) delete copy[id];
      return copy;
    });
    const names = okIds.map((id) => games.find((g) => g.id === id)?.name).filter(Boolean);
    if (names.length) toast.success(`Saved ${names.join(", ")}`);
    const newFirsts = res.tookFirst.filter((id) => {
      const g = games.find((x) => x.id === id);
      return g && !wasWinner(g);
    });
    if (newFirsts.length) {
      const n = newFirsts.map((id) => games.find((g) => g.id === id)?.name).join(", ");
      toast.success(`You're in 1st on ${n}.`);
      void celebrate("first");
    }
    // Fresh data arrives with the action response (revalidatePath); no extra refresh needed.
  }

  async function remove(g: TodayGame) {
    const prev = g.mine;
    setBusy((b) => ({ ...b, [g.id]: true }));
    const res = await deleteScore({ slug, gameId: g.id, date });
    setBusy((b) => ({ ...b, [g.id]: false }));
    if (!res.ok) return toast.error(res.error);
    setDrafts((d) => ({ ...d, [g.id]: "" }));
    // Fresh data arrives with the action response (revalidatePath); no extra refresh needed.
    toast(`Removed your ${g.name} score`, {
      action: prev
        ? {
            label: "Undo",
            onClick: async () => {
              const r = await saveScores({
                slug,
                date,
                entries: [
                  prev.failed
                    ? { gameId: g.id, failed: true }
                    : { gameId: g.id, raw: valueToInput(g, prev.value), failed: false },
                ],
              });
              if (r.ok) {
                setDrafts((d) => {
                  const c = { ...d };
                  delete c[g.id];
                  return c;
                });
                // Fresh data arrives with the action response (revalidatePath); no extra refresh needed.
              }
            },
          }
        : undefined,
    });
  }

  const rowProps = (g: TodayGame) => ({
    game: g,
    meId,
    draft: draftOf(g),
    dirty: isDirty(g),
    error: errors[g.id],
    busy: !!busy[g.id] || savingAll,
    onDraft: (v: string) => {
      setDrafts((d) => ({ ...d, [g.id]: v }));
      setErrors((e) => ({ ...e, [g.id]: undefined }));
    },
    onSave: () => submit([{ game: g, failed: false }]),
    onFail: () => submit([{ game: g, failed: true }]),
    onDelete: () => remove(g),
  });
  const saveAll = () =>
    startSaveAll(() => submit(dirtyGames.map((game) => ({ game, failed: false }))));

  // Ctrl/Cmd + Enter saves every row you've typed in (desktop shortcut).
  const saveAllRef = useRef<() => void>(() => {});
  useEffect(() => {
    saveAllRef.current = dirtyGames.length ? saveAll : () => {};
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        saveAllRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)), [today]);
  const go = (d: string) =>
    startNav(() => router.push(d === today ? `/l/${slug}/today` : `/l/${slug}/today?date=${d}`));
  const doneCount = games.filter((g) => g.mine).length;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="font-display text-[2rem] leading-none font-bold sm:text-[2.5rem]">
            {date === today ? "Today" : date === addDays(today, -1) ? "Yesterday" : formatDay(date)}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {formatDay(date, { year: true })} ·{" "}
            <span className="num text-foreground text-base font-semibold">{doneCount}</span> of{" "}
            {games.length} logged
          </p>
        </div>
        <div className="flex items-center gap-2">
          {navigating && (
            <Loader2 className="text-muted-foreground size-5 animate-spin" aria-label="Loading" />
          )}
          <input
            type="date"
            max={today}
            value={date}
            onChange={(e) => e.target.value && e.target.value <= today && go(e.target.value)}
            className="border-input bg-card text-foreground h-11 cursor-pointer rounded-md border px-2 text-sm"
            aria-label="Pick a date"
          />
        </div>
      </div>

      {/* Last 7 days */}
      <nav
        aria-label="Choose a day"
        className="grid grid-cols-7 divide-x overflow-hidden rounded-md border sm:max-w-xl"
      >
        {days.map((d) => {
          const active = d === date;
          return (
            <button
              key={d}
              type="button"
              onClick={() => go(d)}
              aria-current={active ? "date" : undefined}
              aria-label={formatDay(d, { year: true })}
              className={cn(
                "flex min-h-14 min-w-0 cursor-pointer flex-col items-center justify-center text-[11px] font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted bg-card",
              )}
            >
              <span className="uppercase">{d === today ? "Today" : weekdayShort(d)}</span>
              <span
                className={cn("num text-lg leading-tight font-bold", !active && "text-foreground")}
              >
                {Number(d.slice(8))}
              </span>
            </button>
          );
        })}
      </nav>

      {date !== today && (
        <p className="border-warning text-foreground flex items-center gap-2 border-l-2 py-1 pl-3 text-sm">
          <CalendarClock className="text-warning size-4 shrink-0" aria-hidden />
          <span>
            You&apos;re entering scores for <strong>{formatDay(date)}</strong>, not today.
          </span>
        </p>
      )}

      {/* Phones and tablets: one card per game */}
      <div className="grid gap-4 md:grid-cols-2 lg:hidden">
        {games.map((g) => (
          <GameCard key={`${date}:${g.id}:card`} variant="card" {...rowProps(g)} />
        ))}
      </div>

      {/* Computers: a score sheet with today's running tally beside it */}
      <div className="hidden items-start gap-6 lg:grid xl:grid-cols-[minmax(0,1fr)_17rem]">
        <section aria-label="Score sheet" className="bg-card min-w-0 rounded-md border">
          <div className="border-rule text-muted-foreground grid grid-cols-[minmax(13rem,1fr)_17.5rem_minmax(0,1.15fr)] gap-4 border-b px-4 py-2.5">
            <span className="kicker text-[12px]">Game</span>
            <span className="kicker text-[12px]">Your score</span>
            <span className="kicker text-[12px]">Everyone</span>
          </div>
          <div className="divide-y">
            {games.map((g, i) => (
              <GameCard
                key={`${date}:${g.id}:row`}
                variant="row"
                nextInputId={games[i + 1] ? `score-row-${games[i + 1].id}` : undefined}
                {...rowProps(g)}
              />
            ))}
          </div>
          <p className="text-muted-foreground border-t px-4 py-2.5 text-xs">
            <kbd className="bg-muted rounded px-1 font-mono">Enter</kbd> saves a row and moves to
            the next one · <kbd className="bg-muted rounded px-1 font-mono">Ctrl/⌘ + Enter</kbd>{" "}
            saves everything you&apos;ve typed
          </p>
        </section>
        <DayTally games={games} meId={meId} />
      </div>

      <AnimatePresence>
        {dirtyGames.length > 0 && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 px-4 pb-3 md:bottom-0 md:pb-6"
          >
            <div className="bg-card mx-auto flex max-w-md items-center gap-3 rounded-md border p-2 pl-4 shadow-lg">
              <span className="text-sm">
                <span className="num text-lg font-bold">{dirtyGames.length}</span> unsaved
              </span>
              <Button className="ml-auto" disabled={savingAll} onClick={saveAll}>
                {savingAll ? <Loader2 className="animate-spin" /> : <Check />}
                Save all ({dirtyGames.length})
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface GameProps {
  game: TodayGame;
  meId: string;
  draft: string;
  dirty: boolean;
  error?: string;
  busy: boolean;
  onDraft: (v: string) => void;
  onSave: () => void;
  onFail: () => void;
  onDelete: () => void;
}

/** One game: a card on phones, a score-sheet row on computers. Same controls in both. */
function GameCard(props: GameProps & { variant: "card" | "row"; nextInputId?: string }) {
  const { game: g, variant, dirty } = props;
  const saved = g.mine;
  const ids = {
    input: `score-${variant}-${g.id}`,
    hint: `hint-${variant}-${g.id}`,
    err: `err-${variant}-${g.id}`,
  };

  const title = (
    <h2
      className={cn(
        "font-display flex min-w-0 items-center gap-2 leading-tight font-bold",
        variant === "card" ? "text-xl" : "text-lg",
      )}
    >
      <GameDot color={g.color} className="size-3" />
      <span className="truncate">{g.name}</span>
      {g.url && (
        <a
          href={g.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground -m-1 rounded-sm p-1"
          aria-label={`Play ${g.name} (opens in a new tab)`}
          title={`Play ${g.name}`}
        >
          <ExternalLink className="size-4" />
        </a>
      )}
    </h2>
  );
  const status =
    saved && !dirty ? (
      <span className="text-success flex shrink-0 items-center gap-1 text-sm font-semibold">
        <Check className="size-4" aria-hidden /> Saved{" "}
        <span className="num text-foreground text-lg leading-none">
          {formatValue(g, saved.value, saved.failed)}
        </span>
      </span>
    ) : (
      <span className="text-muted-foreground shrink-0 text-xs">Not logged</span>
    );
  const hint = (
    <div
      id={ids.hint}
      className={cn("leading-snug", variant === "card" ? "text-[15px]" : "text-[13px]")}
    >
      <p className={cn(variant === "row" && "text-muted-foreground")}>{g.entry_prompt}</p>
      {g.entry_example && (
        <p className="text-muted-foreground mt-0.5 text-[13px]">{g.entry_example}</p>
      )}
    </div>
  );

  if (variant === "row") {
    return (
      <div
        data-testid={`game-card-${g.name}`}
        className="grid grid-cols-[minmax(13rem,1fr)_17.5rem_minmax(0,1.15fr)] items-start gap-4 px-4 py-3.5"
      >
        <div className="grid min-w-0 gap-1">
          {title}
          {hint}
        </div>
        <div className="grid gap-1.5">
          <ScoreForm {...props} ids={ids} compact />
          <div className="flex min-h-5 items-center justify-between gap-2">
            {props.error ? <FormError message={props.error} className="text-[13px]" /> : status}
            <span id={ids.err} className="sr-only" aria-live="polite">
              {props.error}
            </span>
            {saved && <ClearButton {...props} />}
          </div>
        </div>
        <Results game={g} meId={props.meId} variant="row" />
      </div>
    );
  }

  return (
    <Card className="flex flex-col" data-testid={`game-card-${g.name}`}>
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          {title}
          {status}
        </div>
        {hint}
        <ScoreForm {...props} ids={ids} />
        {(props.error || saved) && (
          <div className="flex items-center justify-between gap-2">
            <FormError message={props.error} className="text-[13px]" />
            <span id={ids.err} className="sr-only" aria-live="polite">
              {props.error}
            </span>
            {saved && <ClearButton {...props} />}
          </div>
        )}
      </div>
      <Results game={g} meId={props.meId} variant="card" />
    </Card>
  );
}

function ClearButton({ busy, onDelete }: GameProps) {
  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="text-muted-foreground hover:text-destructive -my-2 ml-auto flex min-h-9 cursor-pointer items-center gap-1 rounded-sm px-1 text-[13px]"
    >
      <Trash2 className="size-3.5" aria-hidden /> Clear my score
    </button>
  );
}

function ScoreForm({
  game: g,
  draft,
  dirty,
  error,
  busy,
  onDraft,
  onSave,
  onFail,
  ids,
  compact,
  nextInputId,
}: GameProps & {
  ids: { input: string; hint: string; err: string };
  compact?: boolean;
  nextInputId?: string;
}) {
  const saved = g.mine;
  const h = compact ? "h-10" : "h-12";
  return (
    <form
      className="flex items-stretch gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
        if (nextInputId) document.getElementById(nextInputId)?.focus();
      }}
    >
      <label htmlFor={ids.input} className="sr-only">
        {g.name} score{g.unit_label ? ` (${g.unit_label})` : ""}
      </label>
      <div className="relative min-w-0 flex-1">
        <input
          id={ids.input}
          value={draft}
          onChange={(e) =>
            onDraft(g.input_type === "time" ? formatTimeTyping(e.target.value) : e.target.value)
          }
          inputMode={inputModeFor(g)}
          enterKeyHint="done"
          autoComplete="off"
          placeholder={
            saved?.failed
              ? "X"
              : g.input_type === "time"
                ? "m:ss"
                : g.entry_example.replace(/^e\.g\.\s*/, "")
          }
          aria-describedby={`${ids.hint}${error ? ` ${ids.err}` : ""}`}
          aria-invalid={!!error}
          className={cn(
            "num border-input bg-background placeholder:text-muted-foreground/45 focus-visible:border-ring focus-visible:ring-ring/40 w-full rounded-md border px-3 font-bold outline-none focus-visible:ring-2",
            compact ? "h-10 text-xl" : "h-12 text-[26px]",
            g.unit_label && "pr-16",
            error && "border-destructive",
          )}
        />
        {g.unit_label && (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
            {g.unit_label}
          </span>
        )}
      </div>
      {g.min < 0 && g.input_type !== "time" && (
        <Button
          type="button"
          variant="outline"
          className={cn(h, "w-10 px-0 text-lg")}
          aria-label="Flip plus/minus sign"
          title="Flip +/−"
          onClick={() => {
            const v = draft.trim();
            onDraft(v.startsWith("-") ? v.slice(1) : `-${v.replace(/^\+/, "")}`);
          }}
        >
          ±
        </Button>
      )}
      <Button
        type="submit"
        className={cn(h, compact ? "px-4" : "px-5")}
        disabled={busy || (!dirty && !!saved && !saved.failed)}
      >
        {busy ? <Loader2 className="animate-spin" /> : "Save"}
      </Button>
      {g.allow_fail && (
        <Button
          type="button"
          variant={saved?.failed ? "destructive" : "outline"}
          className={cn(h, "px-3")}
          aria-pressed={!!saved?.failed}
          disabled={busy}
          onClick={onFail}
          title="Didn't finish"
        >
          X{!compact && <span className="sr-only sm:not-sr-only">&nbsp;didn&apos;t finish</span>}
          {compact && <span className="sr-only">&nbsp;didn&apos;t finish</span>}
        </Button>
      )}
    </form>
  );
}

function Results({
  game: g,
  meId,
  variant,
}: {
  game: TodayGame;
  meId: string;
  variant: "card" | "row";
}) {
  if (g.status === "empty") {
    return (
      <p
        className={cn(
          "text-muted-foreground text-sm",
          variant === "card" ? "mt-auto border-t px-4 py-3" : "pt-2",
        )}
      >
        No scores yet. Be the first.
      </p>
    );
  }
  const waiting = g.status === "waiting" && (
    <p
      className={cn(
        "text-warning flex items-center gap-1.5 text-[13px] font-medium",
        variant === "card" ? "px-4 pt-3" : "mb-1",
      )}
    >
      <Hourglass className="size-3.5" aria-hidden /> Waiting for a second player. No points yet.
    </p>
  );
  return (
    <div className={cn(variant === "card" && "mt-auto border-t")}>
      {waiting}
      <ol
        className={cn(variant === "card" ? "px-2 py-1.5" : "grid gap-0.5")}
        aria-label={`${g.name} results`}
      >
        {g.entries.map((e) => (
          <li
            key={e.memberId}
            className={cn(
              "flex items-center gap-2.5 rounded-sm px-2 text-sm",
              variant === "card" ? "min-h-10" : "min-h-8",
              e.memberId === meId && "bg-accent-soft",
            )}
          >
            <RankBadge
              rank={g.status === "scored" ? e.rank : e.failed ? null : e.rank}
              failed={e.failed}
            />
            <span className="min-w-0 flex-1 truncate font-medium">
              {e.name}
              {e.memberId === meId && (
                <span className="text-muted-foreground ml-1.5 text-xs font-normal"> you</span>
              )}
            </span>
            <span className={cn("num font-bold", variant === "card" ? "text-xl" : "text-lg")}>
              {formatValue(g, e.value, e.failed)}
            </span>
            {g.status === "scored" && (
              <span className="num text-accent w-9 text-right text-base font-semibold">
                +{e.points}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Desktop sidebar: points everyone has earned so far on this day. */
function DayTally({ games, meId }: { games: TodayGame[]; meId: string }) {
  const tally = new Map<string, { name: string; points: number; wins: number; played: number }>();
  for (const g of games) {
    for (const e of g.entries) {
      const t = tally.get(e.memberId) ?? { name: e.name, points: 0, wins: 0, played: 0 };
      t.played += 1;
      if (g.status === "scored") {
        t.points += e.points;
        if (e.isWinner) t.wins += 1;
      }
      tally.set(e.memberId, t);
    }
  }
  const rows = [...tally.entries()].sort(
    (a, b) =>
      b[1].points - a[1].points || b[1].wins - a[1].wins || a[1].name.localeCompare(b[1].name),
  );
  return (
    <aside
      className="bg-card sticky top-20 hidden rounded-md border xl:block"
      aria-label="Points so far"
    >
      <h2 className="font-display border-b px-4 py-3 text-lg font-bold tracking-wide uppercase">
        Points so far
      </h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground px-4 py-3 text-sm">Nobody has logged a score yet.</p>
      ) : (
        <ol className="divide-y">
          {rows.map(([id, r], i) => (
            <li
              key={id}
              className={cn("flex items-center gap-2.5 px-4 py-2", id === meId && "bg-accent-soft")}
            >
              <span className="num text-muted-foreground w-5 text-right">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {r.name}
                {id === meId && (
                  <span className="text-muted-foreground text-xs font-normal"> you</span>
                )}
              </span>
              <span className="text-muted-foreground text-xs">
                {r.played} {r.played === 1 ? "game" : "games"}
              </span>
              <span className="num w-8 text-right text-xl font-bold">{r.points}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
