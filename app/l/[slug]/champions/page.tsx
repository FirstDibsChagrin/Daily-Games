import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageTitle } from "@/components/league/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatWeek } from "@/lib/dates";
import { computeWeeks, trophyCounts } from "@/lib/scoring/weeks";
import { today as getToday } from "@/lib/server/clock";
import { loadCompetition } from "@/lib/server/competition";
import { requireLeague } from "@/lib/server/league";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Hall of Champions" };

export default async function ChampionsPage({ params }: PageProps<"/l/[slug]/champions">) {
  const { slug } = await params;
  const ctx = await requireLeague(slug);
  const today = await getToday();
  const { days } = await loadCompetition(ctx, today);
  const weeks = computeWeeks(
    days,
    ctx.members.map((m) => m.id),
    today,
  ).filter((w) => w.completed);
  const counts = trophyCounts(weeks);
  const ranking = ctx.members
    .map((m) => ({ id: m.id, name: m.name, trophies: counts.get(m.id) ?? 0 }))
    .sort((a, b) => b.trophies - a.trophies || a.name.localeCompare(b.name));
  const max = Math.max(1, ...ranking.map((r) => r.trophies));

  return (
    <>
      <PageTitle
        title="Hall of Champions"
        subtitle="Weekly champions: most points Monday–Sunday (ET). Ties go to more 1st places."
      />
      {weeks.length === 0 ? (
        <EmptyState icon={<Trophy />} title="No champions yet">
          The first weekly champion is crowned after Sunday at midnight Eastern.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <Card>
            <CardHeader>
              <CardTitle>Trophy cabinet</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-2" data-testid="trophy-counts">
                {ranking.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-3">
                    <span className="num text-muted-foreground w-6 text-right">{i + 1}</span>
                    <Link
                      href={`/l/${slug}/p/${r.id}`}
                      className="w-28 truncate font-semibold hover:underline"
                    >
                      {r.name}
                    </Link>
                    <div className="bg-muted h-7 flex-1 overflow-hidden rounded-md">
                      <div
                        className={cn(
                          "bg-gold flex h-full items-center rounded-sm px-2",
                          r.trophies === 0 && "bg-none",
                        )}
                        style={{ width: `${(r.trophies / max) * 100}%` }}
                      />
                    </div>
                    <span
                      className="num flex w-12 items-center justify-end gap-1 font-bold"
                      aria-label={`${r.trophies} trophies`}
                    >
                      {r.trophies} <Trophy className="text-gold size-4" aria-hidden />
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Past weeks</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1">
                {[...weeks].reverse().map((w) => {
                  const top = w.standings.find((s) => w.champions.includes(s.memberId));
                  return (
                    <li key={w.weekStart}>
                      <Link
                        href={`/l/${slug}/recap/${w.weekStart}`}
                        className="hover:bg-muted flex items-center gap-3 rounded-md px-2 py-2 text-sm"
                      >
                        <span className="text-muted-foreground w-40 shrink-0">
                          {formatWeek(w.weekStart)}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-semibold">
                          {w.champions.length
                            ? w.champions.map((id) => ctx.memberName.get(id)).join(" & ")
                            : "No champion"}
                        </span>
                        {top && <span className="num text-muted-foreground">{top.points} pts</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
