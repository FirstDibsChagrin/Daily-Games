import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/league/auto-refresh";
import { EmptyState, GameName, PageTitle, RankBadge } from "@/components/league/bits";
import { StandingsTable } from "@/components/league/standings-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, formatDay, isPlainDate } from "@/lib/dates";
import { formatValue } from "@/lib/score-values";
import { computeStandings, rankGameDay } from "@/lib/scoring";
import { today as getToday } from "@/lib/server/clock";
import { getScores, requireLeague } from "@/lib/server/league";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Day" };

export default async function DayPage({ params, searchParams }: PageProps<"/l/[slug]/day">) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireLeague(slug);
  const today = await getToday();
  const raw = typeof sp.date === "string" && isPlainDate(sp.date) ? sp.date : today;
  const date = raw > today ? today : raw;
  const scores = await getScores(ctx.league.id, { from: date, to: date });
  const results = ctx.activeGames.map((g) => ({
    game: g,
    result: rankGameDay(
      scores.filter((s) => s.gameId === g.id),
      g.direction,
      ctx.league.points_table,
      { gameId: g.id, date },
    ),
  }));
  const standings = computeStandings(
    results.map((r) => r.result),
    ctx.members.map((m) => m.id),
  ).map((r) => ({ ...r, name: ctx.memberName.get(r.memberId) ?? "?" }));
  const played = results.filter((r) => r.result.status !== "empty");

  return (
    <>
      <AutoRefresh seconds={45} />
      <PageTitle
        title={date === today ? "Today's results" : formatDay(date)}
        subtitle={formatDay(date, { year: true })}
        actions={
          <div className="flex items-center gap-1">
            <Link
              href={`/l/${slug}/day?date=${addDays(date, -1)}`}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-2"
              aria-label="Previous day"
            >
              <ChevronLeft className="size-5" />
            </Link>
            {date < today ? (
              <Link
                href={`/l/${slug}/day?date=${addDays(date, 1)}`}
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-2"
                aria-label="Next day"
              >
                <ChevronRight className="size-5" />
              </Link>
            ) : (
              <span className="text-muted-foreground/30 p-2" aria-hidden>
                <ChevronRight className="size-5" />
              </span>
            )}
            <Link
              href={`/l/${slug}/today${date === today ? "" : `?date=${date}`}`}
              className="hover:bg-muted ml-2 inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-semibold"
            >
              <Pencil className="size-3.5" aria-hidden /> Enter scores
            </Link>
          </div>
        }
      />

      {played.length === 0 ? (
        <EmptyState icon="📅" title="No scores this day">
          Nobody logged anything for {formatDay(date)}.
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {/* Winner-of-the-day strip */}
          <section
            aria-label="Winners by game"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
            data-testid="winner-strip"
          >
            {results.map(({ game: g, result: r }) => (
              <div
                key={g.id}
                className="bg-card/80 min-w-40 shrink-0 rounded-xl border p-3"
                style={{ borderTopColor: g.color, borderTopWidth: 3 }}
              >
                <GameName
                  name={g.name}
                  color={g.color}
                  className="text-muted-foreground text-xs font-semibold"
                />
                <p className="font-display mt-1 truncate text-lg font-bold">
                  {r.status === "scored"
                    ? r.winners.length
                      ? `👑 ${r.winners.map((id) => ctx.memberName.get(id)).join(" & ")}`
                      : "No winner"
                    : r.status === "waiting"
                      ? "⏳ Waiting"
                      : "—"}
                </p>
              </div>
            ))}
          </section>

          <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr] lg:items-start">
            <Card>
              <CardHeader>
                <CardTitle>Day standings</CardTitle>
              </CardHeader>
              <CardContent>
                <StandingsTable
                  rows={standings}
                  meId={ctx.me.memberId}
                  slug={slug}
                  caption={`Standings for ${formatDay(date)}`}
                />
              </CardContent>
            </Card>
            <div className="grid gap-3 sm:grid-cols-2">
              {results.map(({ game: g, result: r }) => (
                <Card key={g.id} data-testid={`day-game-${g.name}`}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      <GameName name={g.name} color={g.color} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {r.status === "empty" && (
                      <p className="text-muted-foreground text-sm">No scores.</p>
                    )}
                    {r.status === "waiting" && (
                      <p className="text-warning mb-2 text-xs">⏳ Waiting for a second player.</p>
                    )}
                    <ol className="grid gap-1">
                      {r.entries.map((e) => (
                        <li
                          key={e.memberId}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1 text-sm",
                            e.memberId === ctx.me.memberId ? "bg-accent-soft" : "bg-muted/40",
                          )}
                        >
                          <RankBadge rank={e.rank} failed={e.failed} />
                          <span className="min-w-0 flex-1 truncate">
                            {ctx.memberName.get(e.memberId)}
                          </span>
                          <span className="num font-semibold">
                            {formatValue(g, e.value, e.failed)}
                          </span>
                          {r.status === "scored" && (
                            <span className="num text-accent w-9 text-right">+{e.points}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
