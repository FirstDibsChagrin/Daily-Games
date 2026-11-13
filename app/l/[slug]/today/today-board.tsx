"use client";

import { CalendarClock, Check, ExternalLink, Hourglass, Loader2, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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

      <div className="grid gap-4 lg:grid-cols-2">
        {games.map((g) => (
          <GameCard
            key={`${date}:${g.id}`}
            game={g}
            meId={meId}
            draft={draftOf(g)}
            dirty={isDirty(g)}
            error={errors[g.id]}
            busy={!!busy[g.id] || savingAll}
            onDraft={(v) => {
              setDrafts((d) => ({ ...d, [g.id]: v }));
              setErrors((e) => ({ ...e, [g.id]: undefined }));
            }}
            onSave={() => submit([{ game: g, failed: false }])}
            onFail={() => submit([{ game: g, failed: true }])}
            onDelete={() => remove(g)}
          />
        ))}
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
              <Button
                className="ml-auto"
                disabled={savingAll}
                onClick={() =>
                  startSaveAll(() => submit(dirtyGames.map((game) => ({ game, failed: false }))))
                }
              >
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

function GameCard({
  game: g,
  meId,
  draft,
  dirty,
  error,
  busy,
  onDraft,
  onSave,
  onFail,
  onDelete,
}: {
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
}) {
  const inputId = `score-${g.id}`;
  const hintId = `hint-${g.id}`;
  const errId = `err-${g.id}`;
  const saved = g.mine;
  return (
    <Card className="flex flex-col" data-testid={`game-card-${g.name}`}>
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display flex min-w-0 items-center gap-2 text-xl leading-tight font-bold">
            <GameDot color={g.color} className="size-3" />
            <span className="truncate">{g.name}</span>
            {g.url && (
              <a
                href={g.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground -m-1 rounded-sm p-1"
                aria-label={`Play ${g.name} (opens in a new tab)`}
              >
                <ExternalLink className="size-4" />
              </a>
            )}
          </h2>
          {saved && !dirty ? (
            <span className="text-success flex shrink-0 items-center gap-1 text-sm font-semibold">
              <Check className="size-4" aria-hidden /> Saved{" "}
              <span className="num text-foreground text-lg leading-none">
                {formatValue(g, saved.value, saved.failed)}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground shrink-0 text-xs">Not logged</span>
          )}
        </div>

        <div id={hintId} className="text-[15px] leading-snug">
          <p>{g.entry_prompt}</p>
          {g.entry_example && (
            <p className="text-muted-foreground mt-0.5 text-[13px]">{g.entry_example}</p>
          )}
        </div>

        <form
          className="flex items-stretch gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            {g.name} score{g.unit_label ? ` (${g.unit_label})` : ""}
          </label>
          <div className="relative min-w-0 flex-1">
            <input
              id={inputId}
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
              aria-describedby={`${hintId}${error ? ` ${errId}` : ""}`}
              aria-invalid={!!error}
              className={cn(
                "num border-input bg-background placeholder:text-muted-foreground/45 focus-visible:border-ring focus-visible:ring-ring/40 h-12 w-full rounded-md border px-3 text-[26px] font-bold outline-none focus-visible:ring-2",
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
              className="h-12 w-11 px-0 text-lg"
              aria-label="Flip plus/minus sign"
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
            className="h-12 px-5"
            disabled={busy || (!dirty && !!saved && !saved.failed)}
          >
            {busy ? <Loader2 className="animate-spin" /> : "Save"}
          </Button>
          {g.allow_fail && (
            <Button
              type="button"
              variant={saved?.failed ? "destructive" : "outline"}
              className="h-12 px-3"
              aria-pressed={!!saved?.failed}
              disabled={busy}
              onClick={onFail}
              title="Didn't finish"
            >
              X<span className="sr-only sm:not-sr-only">&nbsp;didn&apos;t finish</span>
            </Button>
          )}
        </form>
        {(error || saved) && (
          <div className="flex items-center justify-between gap-2">
            <FormError message={error} className="text-[13px]" />
            <span id={errId} className="sr-only" aria-live="polite">
              {error}
            </span>
            {saved && (
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="text-muted-foreground hover:text-destructive -my-2 ml-auto flex min-h-9 cursor-pointer items-center gap-1 rounded-sm px-1 text-[13px]"
              >
                <Trash2 className="size-3.5" aria-hidden /> Clear my score
              </button>
            )}
          </div>
        )}
      </div>

      <DayBoard game={g} meId={meId} />
    </Card>
  );
}

function DayBoard({ game: g, meId }: { game: TodayGame; meId: string }) {
  if (g.status === "empty") {
    return (
      <p className="text-muted-foreground mt-auto border-t px-4 py-3 text-sm">
        No scores yet. Be the first.
      </p>
    );
  }
  return (
    <div className="mt-auto border-t">
      {g.status === "waiting" && (
        <p className="text-warning flex items-center gap-1.5 px-4 pt-3 text-[13px] font-medium">
          <Hourglass className="size-3.5" aria-hidden /> Waiting for a second player. No points yet.
        </p>
      )}
      <ol className="px-2 py-1.5" aria-label={`${g.name} results`}>
        <AnimatePresence initial={false}>
          {g.entries.map((e) => (
            <motion.li
              key={e.memberId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex min-h-10 items-center gap-2.5 rounded-sm px-2 text-sm",
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
              <span className="num text-xl font-bold">{formatValue(g, e.value, e.failed)}</span>
              {g.status === "scored" && (
                <span className="num text-accent w-9 text-right text-base font-semibold">
                  +{e.points}
                </span>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}
