import { Crown, Flame, NotebookPen, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeChip } from "@/components/league/badge-list";
import { EmptyState, GameName, ordinal } from "@/components/league/bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShort, formatWeek, isPlainDate, weekStart } from "@/lib/dates";
import { memberGameStats } from "@/lib/game-stats";
import { formatValue } from "@/lib/score-values";
import { computeStandings } from "@/lib/scoring";
import { computeStreak } from "@/lib/scoring/streaks";
import { today as getToday } from "@/lib/server/clock";
import { loadInsights } from "@/lib/server/insights";
import { requireLeague } from "@/lib/server/league";
import { ProfileCharts, type ChartGame } from "./profile-charts";

export const metadata: Metadata = { title: "Player" };

export default async function ProfilePage({ params }: PageProps<"/l/[slug]/p/[memberId]">) {
  const { slug, memberId } = await params;
  const ctx = await requireLeague(slug);
  const member = ctx.members.find((m) => m.id === memberId);
  if (!member) notFound();
  const today = await getToday();
  const { scores, days, weeks, badges, memberIds } = await loadInsights(ctx, today);

  const mine = scores.filter((s) => s.memberId === member.id);
  const streak = computeStreak(
    mine.map((s) => s.date),
    today,
  );
  const allTime = computeStandings(days, memberIds);
  const myRow = allTime.find((r) => r.memberId === member.id)!;
  const trophyWeeks = weeks.filter((w) => w.completed && w.champions.includes(member.id));
  const myBadges = badges.filter((b) => b.member_id === member.id);
  const gameName = new Map(ctx.games.map((g) => [g.id, g.name]));
  const isMe = member.id === ctx.me.memberId;

  const perGame = ctx.activeGames.map((g) => {
    const [st] = memberGameStats([member.id], g.id, g.direction, scores, days);
    const gs = computeStreak(
      mine.filter((s) => s.gameId === g.id).map((s) => s.date),
      today,
    );
    return { game: g, st, streak: gs };
  });

  const chartGames: ChartGame[] = perGame
    .filter((p) => p.st.plays > 0)
    .map(({ game: g }) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      inputType: g.input_type,
      min: g.min,
      direction: g.direction,
      points: mine
        .filter((s) => s.gameId === g.id)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((s) => ({ date: s.date, value: s.value, failed: s.failed })),
    }));

  const weeklyPoints = weeks.map((w) => {
    const r = w.standings.find((s) => s.memberId === member.id);
    return { week: w.weekStart, points: r?.points ?? 0, champion: w.champions.includes(member.id) };
  });

  const badgeDetail = (key: string, ctxKey: string) => {
    if (!ctxKey) return null;
    if (key === "specialist") return `${gameName.get(ctxKey) ?? "A game"}`;
    if (key === "comeback_kid") return `Week of ${formatShort(ctxKey)}`;
    if (isPlainDate(ctxKey)) return formatShort(ctxKey);
    return null;
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="bg-primary text-primary-foreground font-display flex size-16 items-center justify-center rounded-md text-4xl font-bold">
          {member.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display flex items-center gap-2 text-3xl font-bold">
            {member.name}
            {member.is_creator && (
              <Crown className="text-gold size-5" aria-label="League creator" />
            )}
            {isMe && <span className="text-accent text-base font-normal"> (you)</span>}
          </h1>
          <p className="text-muted-foreground text-sm">
            {mine.length} {mine.length === 1 ? "score" : "scores"} logged · joined{" "}
            {formatShort(member.created_at.toISOString().slice(0, 10))}
          </p>
        </div>
        <Link
          href={`/l/${slug}/stats`}
          className="text-accent text-sm font-semibold hover:underline"
        >
          All players →
        </Link>
      </div>

      {/* Headline numbers */}
      <section aria-label="Summary" className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="All-time points"
          value={myRow.points}
          sub={myRow.points ? `${ordinal(myRow.rank)} in league` : undefined}
        />
        <Stat
          label="1st places"
          value={myRow.wins}
          sub={`${myRow.played} ${myRow.played === 1 ? "game" : "games"} played`}
        />
        <Stat
          label="Current streak"
          value={streak.current}
          sub={`Longest ${streak.longest} day${streak.longest === 1 ? "" : "s"}`}
          icon={<Flame className="text-warning size-4" aria-hidden />}
          testId="streak-current"
        />
        <Stat
          label="Weekly titles"
          value={trophyWeeks.length}
          sub={myRow.played ? `${myRow.avg.toFixed(2)} avg pts/game` : undefined}
          icon={<Trophy className="text-gold size-4" aria-hidden />}
        />
      </section>

      {mine.length === 0 ? (
        <EmptyState icon={<NotebookPen />} title="No scores yet">
          {isMe
            ? "Log your first score on the Today tab to earn the Rookie badge."
            : `${member.name} hasn't logged any scores yet.`}
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Badges ({myBadges.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {myBadges.length === 0 ? (
                <p className="text-muted-foreground text-sm">No badges yet.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="badges">
                  {myBadges.map((b) => (
                    <BadgeChip
                      key={`${b.badge_key}-${b.context_key}`}
                      badgeKey={b.badge_key}
                      earnedOn={b.earned_on}
                      detail={badgeDetail(b.badge_key, b.context_key)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By game</CardTitle>
              <CardDescription>
                Win rate counts only games with at least two players that day.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm" data-testid="per-game-stats">
                <thead>
                  <tr className="text-muted-foreground text-left text-xs tracking-wider uppercase">
                    <th scope="col" className="py-1 pr-2">
                      Game
                    </th>
                    <th scope="col" className="px-2 text-right">
                      Avg
                    </th>
                    <th scope="col" className="px-2 text-right">
                      Best
                    </th>
                    <th scope="col" className="px-2 text-right">
                      Worst
                    </th>
                    <th scope="col" className="px-2 text-right">
                      Plays
                    </th>
                    <th scope="col" className="px-2 text-right">
                      Wins
                    </th>
                    <th scope="col" className="px-2 text-right">
                      Win rate
                    </th>
                    <th scope="col" className="pl-2 text-right">
                      Streak (best)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {perGame.map(({ game: g, st, streak: gs }) => (
                    <tr key={g.id} className="border-t">
                      <td className="py-2 pr-2 font-medium">
                        <GameName name={g.name} color={g.color} />
                      </td>
                      <td className="num px-2 text-right">
                        {st.avg === null
                          ? "–"
                          : g.input_type === "time"
                            ? formatValue(g, st.avg, false)
                            : st.avg.toFixed(1)}
                      </td>
                      <td className="num px-2 text-right">
                        {st.best === null ? "–" : formatValue(g, st.best, false)}
                      </td>
                      <td className="num px-2 text-right">
                        {st.worst === null ? "–" : formatValue(g, st.worst, false)}
                      </td>
                      <td className="num px-2 text-right">
                        {st.plays}
                        {st.fails ? (
                          <span className="text-muted-foreground text-xs"> ({st.fails} X)</span>
                        ) : null}
                      </td>
                      <td className="num px-2 text-right">{st.wins}</td>
                      <td className="num px-2 text-right">
                        {st.winRate === null ? "–" : `${Math.round(st.winRate * 100)}%`}
                      </td>
                      <td className="num pl-2 text-right">
                        {gs.current} <span className="text-muted-foreground">({gs.longest})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <ProfileCharts
            games={chartGames}
            weeklyPoints={weeklyPoints}
            currentWeek={weekStart(today)}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="text-gold size-5" aria-hidden /> Weekly championships
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trophyWeeks.length === 0 ? (
                <p className="text-muted-foreground text-sm">No weekly titles yet.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {trophyWeeks.map((w) => (
                    <li key={w.weekStart}>
                      <Link
                        href={`/l/${slug}/recap/${w.weekStart}`}
                        className="border-gold/40 bg-gold/10 hover:bg-gold/20 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold"
                      >
                        <Trophy className="size-3.5" aria-hidden /> {formatWeek(w.weekStart)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
  testId,
}: {
  label: string;
  value: number;
  sub?: string;
  icon?: React.ReactNode;
  testId?: string;
}) {
  return (
    <Card className="p-4" data-testid={testId}>
      <p className="text-muted-foreground flex items-center gap-1 text-xs font-semibold tracking-wider uppercase">
        {icon}
        {label}
      </p>
      <p className="num mt-1 text-3xl font-bold">{value}</p>
      {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
    </Card>
  );
}
