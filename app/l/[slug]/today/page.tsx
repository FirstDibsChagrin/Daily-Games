import { Puzzle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/league/auto-refresh";
import { EmptyState } from "@/components/league/bits";
import { Button } from "@/components/ui/button";
import { isPlainDate } from "@/lib/dates";
import { rankGameDay } from "@/lib/scoring";
import { today as getToday } from "@/lib/server/clock";
import { getScores, requireLeague } from "@/lib/server/league";
import { TodayBoard, type TodayGame } from "./today-board";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({ params, searchParams }: PageProps<"/l/[slug]/today">) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireLeague(slug);
  const today = await getToday();
  const requested = typeof sp.date === "string" && isPlainDate(sp.date) ? sp.date : today;
  const date = requested > today ? today : requested;

  if (ctx.activeGames.length === 0) {
    return (
      <EmptyState icon={<Puzzle />} title="No games yet">
        {ctx.me.isCreator ? (
          <>
            <p>Pick the daily puzzles your league plays.</p>
            <Button asChild className="mt-3">
              <Link href={`/l/${slug}/settings/games`}>Choose games</Link>
            </Button>
          </>
        ) : (
          <>
            <p>The league creator hasn&apos;t added any games yet.</p>
            <Button asChild variant="outline" className="mt-3">
              <Link href={`/l/${slug}/league#suggest`}>Suggest a game</Link>
            </Button>
          </>
        )}
      </EmptyState>
    );
  }

  const scores = await getScores(ctx.league.id, { from: date, to: date });
  const games: TodayGame[] = ctx.activeGames.map((g) => {
    const rows = scores.filter((s) => s.gameId === g.id);
    const result = rankGameDay(rows, g.direction, ctx.league.points_table, { gameId: g.id, date });
    const mine = rows.find((s) => s.memberId === ctx.me.memberId) ?? null;
    return {
      id: g.id,
      name: g.name,
      color: g.color,
      url: g.url,
      entry_prompt: g.entry_prompt,
      entry_example: g.entry_example,
      input_type: g.input_type,
      min: g.min,
      max: g.max,
      direction: g.direction,
      allow_fail: g.allow_fail,
      unit_label: g.unit_label,
      mine: mine ? { value: mine.value, failed: mine.failed } : null,
      status: result.status,
      entries: result.entries.map((e) => ({
        memberId: e.memberId,
        name: ctx.memberName.get(e.memberId) ?? "?",
        value: e.value,
        failed: e.failed,
        rank: e.rank,
        points: e.points,
        isWinner: e.isWinner,
      })),
    };
  });

  return (
    <>
      <AutoRefresh seconds={60} />
      <TodayBoard slug={slug} date={date} today={today} meId={ctx.me.memberId} games={games} />
    </>
  );
}
