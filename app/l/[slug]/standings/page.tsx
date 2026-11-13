import { CalendarDays, Crown, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/league/auto-refresh";
import { CelebrateOnce } from "@/components/league/celebrate-once";
import { EmptyState, GameName, PageTitle } from "@/components/league/bits";
import { GameFilter } from "@/components/league/game-filter";
import { PeriodNav } from "@/components/league/period-nav";
import { StandingsTable } from "@/components/league/standings-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDay,
  formatShort,
  isCurrentPeriod,
  isPlainDate,
  PERIOD_KINDS,
  periodFor,
  periodLabel,
  type PeriodKind,
} from "@/lib/dates";
import { memberGameStats } from "@/lib/game-stats";
import { formatValue } from "@/lib/score-values";
import { championsOf, computeStandings } from "@/lib/scoring";
import { today as getToday } from "@/lib/server/clock";
import { loadCompetition } from "@/lib/server/competition";
import { requireLeague } from "@/lib/server/league";

export const metadata: Metadata = { title: "Standings" };

export default async function StandingsPage({
  params,
  searchParams,
}: PageProps<"/l/[slug]/standings">) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireLeague(slug);
  const today = await getToday();

  const kind: PeriodKind = PERIOD_KINDS.includes(sp.period as PeriodKind)
    ? (sp.period as PeriodKind)
    : "week";
  const anchorRaw = typeof sp.date === "string" && isPlainDate(sp.date) ? sp.date : today;
  const period = periodFor(kind, anchorRaw > today ? today : anchorRaw);
  const game = ctx.activeGames.find((g) => g.id === sp.game) ?? null;

  const hrefFor = (k: PeriodKind, anchor: string | null) => {
    const p = new URLSearchParams();
    p.set("period", k);
    if (anchor) p.set("date", anchor);
    if (game) p.set("game", game.id);
    return `/l/${slug}/standings?${p.toString()}`;
  };

  if (ctx.activeGames.length === 0) {
    return (
      <>
        <PageTitle title="Standings" />
        <EmptyState icon="🏆" title="No games yet">
          Standings appear once the league has games and scores.
        </EmptyState>
      </>
    );
  }

  const { scores, days } = await loadCompetition(ctx, today, {
    from: period.start,
    to: period.end,
  });
  const memberIds = ctx.members.map((m) => m.id);
  const standings = computeStandings(days, memberIds, { gameId: game?.id ?? null }).map((r) => ({
    ...r,
    name: ctx.memberName.get(r.memberId) ?? "?",
  }));
  const current = isCurrentPeriod(period, today);
  const weekDone = kind === "week" && period.end! < today;
  const champions = weekDone && !game ? championsOf(standings) : [];
  const iWon = champions.includes(ctx.me.memberId);
  const hasAnyPoints = standings.some((r) => r.points > 0);
  const label = periodLabel(period, today);

  // Per-day winners for the selected game (or every game for a single day)
  const winnerDays = days
    .filter((d) => (game ? d.gameId === game.id : true) && d.status === "scored")
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const gameById = new Map(ctx.activeGames.map((g) => [g.id, g]));
  const stats = game ? memberGameStats(memberIds, game.id, game.direction, scores, days) : [];

  return (
    <>
      <AutoRefresh seconds={45} />
      <PageTitle
        title="Standings"
        subtitle={
          <>
            {label}
            {game ? ` · ${game.name}` : " · All games"}
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PeriodNav period={period} today={today} hrefFor={hrefFor} />
        <GameFilter
          games={ctx.activeGames.map((g) => ({ id: g.id, name: g.name }))}
          value={game?.id ?? null}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="grid gap-4">
          {champions.length > 0 && (
            <Card className="glow border-gold/40 overflow-hidden">
              {iWon && <CelebrateOnce storageKey={`dl-champ-${ctx.league.id}-${period.start}`} />}
              <div className="from-gold/15 flex items-center gap-4 bg-gradient-to-r to-transparent p-4">
                <Trophy className="text-gold size-10 shrink-0" aria-hidden />
                <div>
                  <p className="text-gold text-xs font-semibold tracking-widest uppercase">
                    Weekly {champions.length > 1 ? "co-champions" : "champion"}
                  </p>
                  <p className="font-display text-2xl font-bold" data-testid="week-champion">
                    {champions.map((id) => ctx.memberName.get(id)).join(" & ")}
                  </p>
                  <Link
                    href={`/l/${slug}/recap/${period.start}`}
                    className="text-accent text-sm font-semibold hover:underline"
                  >
                    See the weekly recap →
                  </Link>
                </div>
              </div>
            </Card>
          )}
          {weekDone && !game && champions.length === 0 && (
            <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
              No points this week, so no champion.
            </p>
          )}
          <Card>
            <CardContent className="pt-4 sm:pt-4">
              {!hasAnyPoints && (
                <p className="text-muted-foreground mb-2 text-sm">
                  No points yet for this period. Points are awarded once at least two players log
                  the same game on the same day.
                </p>
              )}
              <StandingsTable
                rows={standings}
                meId={ctx.me.memberId}
                slug={slug}
                caption={`Standings, ${label}`}
                leaderLabel={
                  kind === "week" && current && !game
                    ? "Current leader"
                    : kind === "week" && weekDone && !game
                      ? "Champion"
                      : null
                }
              />
              <p className="text-muted-foreground mt-2 text-xs">
                Ties are broken by 1st-place finishes. <strong>Avg</strong> = points per game
                played, fair to people who play fewer games.
              </p>
            </CardContent>
          </Card>

          {game && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <GameName name={game.name} color={game.color} /> stats
                </CardTitle>
                <CardDescription>{label}</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="game-stats">
                  <thead>
                    <tr className="text-muted-foreground text-left text-xs tracking-wider uppercase">
                      <th scope="col" className="py-1 pr-2">
                        Player
                      </th>
                      <th scope="col" className="px-2 text-right">
                        Wins
                      </th>
                      <th scope="col" className="px-2 text-right">
                        Avg
                      </th>
                      <th scope="col" className="px-2 text-right">
                        Best
                      </th>
                      <th scope="col" className="pl-2 text-right">
                        Plays
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats
                      .filter((s) => s.plays > 0)
                      .sort((a, b) => b.wins - a.wins || b.plays - a.plays)
                      .map((s) => (
                        <tr key={s.memberId} className="border-t">
                          <td className="py-2 pr-2 font-medium">
                            {ctx.memberName.get(s.memberId)}
                          </td>
                          <td className="num px-2 text-right">{s.wins}</td>
                          <td className="num px-2 text-right">
                            {s.avg === null
                              ? "–"
                              : game.input_type === "time"
                                ? formatValue(game, s.avg, false)
                                : s.avg.toFixed(1)}
                          </td>
                          <td className="num px-2 text-right">
                            {s.best === null ? "–" : formatValue(game, s.best, false)}
                          </td>
                          <td className="num pl-2 text-right">{s.plays}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {stats.every((s) => s.plays === 0) && (
                  <p className="text-muted-foreground text-sm">No scores in this period.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="text-gold size-5" aria-hidden /> Daily winners
            </CardTitle>
            <CardDescription>
              Who won {game ? game.name : "each game"} each day.{" "}
              {kind === "day" && (
                <Link
                  href={`/l/${slug}/day?date=${period.anchor}`}
                  className="text-accent font-semibold hover:underline"
                >
                  Full day view →
                </Link>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {winnerDays.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No contested games in this period yet.
              </p>
            ) : (
              <ul
                className="grid max-h-[32rem] gap-1 overflow-y-auto pr-1"
                data-testid="daily-winners"
              >
                {winnerDays.slice(0, 200).map((d) => {
                  const g = gameById.get(d.gameId)!;
                  const names = d.winners.map((id) => ctx.memberName.get(id)).join(" & ");
                  const best = d.entries.find((e) => e.isWinner);
                  return (
                    <li key={`${d.date}-${d.gameId}`}>
                      <Link
                        href={`/l/${slug}/day?date=${d.date}`}
                        className="hover:bg-muted flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
                      >
                        <span className="text-muted-foreground w-14 shrink-0 text-xs">
                          {formatShort(d.date)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {names ? (
                            <>
                              <strong>{names}</strong> won{" "}
                              <GameName name={g.name} color={g.color} className="align-middle" />
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              Nobody finished{" "}
                              <GameName name={g.name} color={g.color} className="align-middle" />
                            </span>
                          )}
                        </span>
                        {best && (
                          <span className="num shrink-0 font-semibold">
                            {formatValue(g, best.value, false)}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              href={`/l/${slug}/day?date=${kind === "day" ? period.anchor : today}`}
              className="text-accent mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              <CalendarDays className="size-4" aria-hidden /> Day view (
              {formatDay(kind === "day" ? period.anchor : today)})
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
