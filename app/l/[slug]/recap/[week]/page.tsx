import { ChevronLeft, ChevronRight, Flame, Trophy, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeChip } from "@/components/league/badge-list";
import { CelebrateOnce } from "@/components/league/celebrate-once";
import { GameName, RankBadge } from "@/components/league/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, formatDay, formatWeek, isPlainDate, weekStart } from "@/lib/dates";
import { buildRecap } from "@/lib/scoring/recap";
import { today as getToday } from "@/lib/server/clock";
import { loadInsights } from "@/lib/server/insights";
import { requireLeague } from "@/lib/server/league";

export const metadata: Metadata = { title: "Weekly recap" };

export default async function RecapPage({ params }: PageProps<"/l/[slug]/recap/[week]">) {
  const { slug, week: weekParam } = await params;
  if (!isPlainDate(weekParam) || weekStart(weekParam) !== weekParam) notFound();
  const ctx = await requireLeague(slug);
  const today = await getToday();
  const { scores, days, weeks, badges, memberIds } = await loadInsights(ctx, today);
  const week = weeks.find((w) => w.weekStart === weekParam);
  const name = (id: string) => ctx.memberName.get(id) ?? "?";
  const names = (ids: string[]) => ids.map(name).join(" & ");

  const nav = (
    <div className="flex items-center gap-1">
      <Link
        href={`/l/${slug}/recap/${addDays(weekParam, -7)}`}
        className="hover:bg-muted rounded-md p-2"
        aria-label="Previous week"
      >
        <ChevronLeft className="size-5" />
      </Link>
      {addDays(weekParam, 7) <= weekStart(today) && (
        <Link
          href={`/l/${slug}/recap/${addDays(weekParam, 7)}`}
          className="hover:bg-muted rounded-md p-2"
          aria-label="Next week"
        >
          <ChevronRight className="size-5" />
        </Link>
      )}
    </div>
  );

  if (!week || !week.completed) {
    return (
      <>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Week of {formatWeek(weekParam)}</h1>
          {nav}
        </div>
        <Card className="text-muted-foreground p-6">
          {weekParam >= weekStart(today)
            ? "This week isn't over yet. The recap appears after Sunday at midnight Eastern."
            : "No games were played this week."}
        </Card>
      </>
    );
  }

  const recap = buildRecap(week, days, scores, memberIds);
  const newBadges = badges.filter(
    (b) => b.earned_on >= week.weekStart && b.earned_on <= week.weekEnd,
  );
  const gameById = new Map(ctx.activeGames.map((g) => [g.id, g]));
  const iWon = recap.champions.includes(ctx.me.memberId);

  return (
    <article className="grid gap-4" data-testid="recap">
      {iWon && <CelebrateOnce storageKey={`dl-champ-${ctx.league.id}-${week.weekStart}`} />}
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-accent text-xs font-semibold tracking-widest uppercase">
            Weekly recap
          </p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {formatWeek(week.weekStart)}
          </h1>
        </div>
        {nav}
      </div>

      <Card className="glow border-gold/40 overflow-hidden">
        <div className="from-gold/20 via-gold/5 flex items-center gap-4 bg-gradient-to-r to-transparent p-5">
          <Trophy className="text-gold size-12 shrink-0" aria-hidden />
          <div>
            <p className="text-gold text-xs font-semibold tracking-widest uppercase">
              {recap.champions.length > 1
                ? "Co-champions"
                : recap.champions.length
                  ? "Champion"
                  : "No champion"}
            </p>
            <p className="font-display text-3xl font-bold" data-testid="recap-champion">
              {recap.champions.length ? names(recap.champions) : "Nobody scored points"}
            </p>
            {recap.podium[0] && (
              <p className="num text-muted-foreground text-sm">{recap.podium[0].points} points</p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Podium</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-2">
              {recap.podium.map((p) => (
                <li
                  key={p.memberId}
                  className="bg-muted/40 flex items-center gap-2 rounded-lg px-2 py-2"
                >
                  <RankBadge rank={p.rank} />
                  <Link
                    href={`/l/${slug}/p/${p.memberId}`}
                    className="flex-1 font-semibold hover:underline"
                  >
                    {name(p.memberId)}
                  </Link>
                  <span className="num font-bold">{p.points}</span>
                  <span className="num text-muted-foreground w-16 text-right text-xs">
                    {p.wins} wins
                  </span>
                </li>
              ))}
            </ol>
            <Link
              href={`/l/${slug}/standings?period=week&date=${week.weekStart}`}
              className="text-accent mt-3 inline-block text-sm font-semibold hover:underline"
            >
              Full standings →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Game of the week winners</CardTitle>
          </CardHeader>
          <CardContent>
            {recap.gameWinners.length === 0 ? (
              <p className="text-muted-foreground text-sm">No contested games.</p>
            ) : (
              <ul className="grid gap-1.5">
                {recap.gameWinners.map((gw) => {
                  const g = gameById.get(gw.gameId);
                  if (!g) return null;
                  return (
                    <li key={gw.gameId} className="flex items-center gap-2 text-sm">
                      <GameName
                        name={g.name}
                        color={g.color}
                        className="w-36 shrink-0 font-medium"
                      />
                      <span className="flex-1 truncate font-semibold">{names(gw.memberIds)}</span>
                      <span className="num text-muted-foreground text-xs">
                        {gw.wins} {gw.wins === 1 ? "win" : "wins"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="p-5">
          <p className="text-muted-foreground flex items-center gap-1 text-xs font-semibold tracking-wider uppercase">
            <Zap className="text-accent size-4" aria-hidden /> Biggest single day
          </p>
          {recap.bestDay ? (
            <>
              <p className="font-display mt-1 text-2xl font-bold">
                {names(recap.bestDay.memberIds)}
              </p>
              <p className="text-muted-foreground text-sm">
                <span className="num text-foreground font-semibold">
                  {recap.bestDay.points} points
                </span>{" "}
                on {formatDay(recap.bestDay.date)}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground mt-1 text-sm">—</p>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-muted-foreground flex items-center gap-1 text-xs font-semibold tracking-wider uppercase">
            <Flame className="text-warning size-4" aria-hidden /> Longest streak this week
          </p>
          {recap.longestStreak ? (
            <>
              <p className="font-display mt-1 text-2xl font-bold">
                {names(recap.longestStreak.memberIds)}
              </p>
              <p className="num text-muted-foreground text-sm">
                {recap.longestStreak.days} days in a row
              </p>
            </>
          ) : (
            <p className="text-muted-foreground mt-1 text-sm">—</p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New badges</CardTitle>
        </CardHeader>
        <CardContent>
          {newBadges.length === 0 ? (
            <p className="text-muted-foreground text-sm">No new badges this week.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {newBadges.map((b) => (
                <li key={`${b.member_id}-${b.badge_key}-${b.context_key}`}>
                  <p className="text-muted-foreground mb-1 text-xs font-semibold">
                    {name(b.member_id)}
                  </p>
                  <BadgeChip badgeKey={b.badge_key} earnedOn={b.earned_on} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-center text-xs">
        {recap.totalScores} scores logged this week.
      </p>
    </article>
  );
}
