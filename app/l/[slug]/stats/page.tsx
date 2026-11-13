import { ChevronRight, Flame, Newspaper, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BadgeChip } from "@/components/league/badge-list";
import { PageTitle } from "@/components/league/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatWeek } from "@/lib/dates";
import { computeStandings } from "@/lib/scoring";
import { computeStreak } from "@/lib/scoring/streaks";
import { trophyCounts } from "@/lib/scoring/weeks";
import { today as getToday } from "@/lib/server/clock";
import { loadInsights } from "@/lib/server/insights";
import { requireLeague } from "@/lib/server/league";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Stats" };

export default async function StatsPage({ params }: PageProps<"/l/[slug]/stats">) {
  const { slug } = await params;
  const ctx = await requireLeague(slug);
  const today = await getToday();
  const { scores, days, weeks, badges, memberIds } = await loadInsights(ctx, today);
  const standings = computeStandings(days, memberIds);
  const trophies = trophyCounts(weeks.filter((w) => w.completed));
  const lastRecap = [...weeks].reverse().find((w) => w.completed);
  const rows = standings.map((r) => {
    const s = computeStreak(
      scores.filter((x) => x.memberId === r.memberId).map((x) => x.date),
      today,
    );
    return {
      ...r,
      name: ctx.memberName.get(r.memberId) ?? "?",
      streak: s,
      trophies: trophies.get(r.memberId) ?? 0,
      badges: badges.filter((b) => b.member_id === r.memberId).length,
    };
  });

  return (
    <>
      <PageTitle
        title="Stats"
        subtitle="All-time numbers, streaks and badges. Tap a player for their full profile."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Link href={`/l/${slug}/champions`} className="group rounded-md">
          <Card className="group-hover:border-ring/60 flex items-center gap-3 p-4 transition-colors">
            <Trophy className="text-gold size-8" aria-hidden />
            <div className="flex-1">
              <p className="font-display text-lg font-semibold">Hall of Champions</p>
              <p className="text-muted-foreground text-sm">Weekly titles for every player</p>
            </div>
            <ChevronRight className="text-muted-foreground" aria-hidden />
          </Card>
        </Link>
        <Link href={`/l/${slug}/recap`} className="group rounded-md">
          <Card className="group-hover:border-ring/60 flex items-center gap-3 p-4 transition-colors">
            <Newspaper className="text-accent size-8" aria-hidden />
            <div className="flex-1">
              <p className="font-display text-lg font-semibold">Weekly recaps</p>
              <p className="text-muted-foreground text-sm">
                {lastRecap
                  ? `Latest: ${formatWeek(lastRecap.weekStart)}`
                  : "First recap after this Sunday"}
              </p>
            </div>
            <ChevronRight className="text-muted-foreground" aria-hidden />
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Players</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="text-muted-foreground text-left text-xs tracking-wider uppercase">
                  <th scope="col" className="py-1 pr-2">
                    Player
                  </th>
                  <th scope="col" className="px-2 text-right">
                    Pts
                  </th>
                  <th scope="col" className="px-2 text-right">
                    Wins
                  </th>
                  <th
                    scope="col"
                    className="px-2 text-right"
                    title="Current participation streak (longest)"
                  >
                    Streak
                  </th>
                  <th scope="col" className="px-2 text-right">
                    Titles
                  </th>
                  <th scope="col" className="pl-2 text-right">
                    Badges
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.memberId}
                    className={cn("border-t", r.memberId === ctx.me.memberId && "bg-accent-soft")}
                  >
                    <td className="py-2 pr-2">
                      <Link
                        href={`/l/${slug}/p/${r.memberId}`}
                        className="font-semibold hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="num px-2 text-right font-bold">{r.points}</td>
                    <td className="num px-2 text-right">{r.wins}</td>
                    <td className="num px-2 text-right">
                      <span className="inline-flex items-center gap-1">
                        {r.streak.current > 0 && (
                          <Flame className="text-warning size-3.5" aria-hidden />
                        )}
                        {r.streak.current}
                        <span className="text-muted-foreground">({r.streak.longest})</span>
                      </span>
                    </td>
                    <td className="num px-2 text-right">{r.trophies}</td>
                    <td className="num pl-2 text-right">{r.badges}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent badges</CardTitle>
          </CardHeader>
          <CardContent>
            {badges.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No badges yet. Log a score to earn Rookie!
              </p>
            ) : (
              <ul className="grid gap-2">
                {badges.slice(0, 8).map((b) => (
                  <li key={`${b.member_id}-${b.badge_key}-${b.context_key}`}>
                    <p className="text-muted-foreground mb-1 text-xs font-semibold">
                      {ctx.memberName.get(b.member_id)}
                    </p>
                    <BadgeChip badgeKey={b.badge_key} earnedOn={b.earned_on} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
