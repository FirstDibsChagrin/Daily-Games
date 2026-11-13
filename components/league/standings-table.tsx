"use client";

import { Crown } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { RankBadge } from "@/components/league/bits";
import { cn } from "@/lib/utils";

export interface StandingView {
  memberId: string;
  name: string;
  points: number;
  wins: number;
  played: number;
  avg: number;
  rank: number;
}

export function StandingsTable({
  rows,
  meId,
  slug,
  leaderLabel,
  caption,
}: {
  rows: StandingView[];
  meId: string;
  slug: string;
  /** e.g. "Leader" or "Champion" for rank-1 rows */
  leaderLabel?: string | null;
  caption: string;
}) {
  const anyPoints = rows.some((r) => r.points > 0);
  const th = "kicker text-muted-foreground px-2 pb-2 text-[12px]";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" data-testid="standings">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-rule border-b text-left">
            <th scope="col" className={cn(th, "w-11")}>
              Rk
            </th>
            <th scope="col" className={th}>
              Player
            </th>
            <th scope="col" className={cn(th, "text-right")}>
              Pts
            </th>
            <th scope="col" className={cn(th, "text-right")} title="1st-place finishes">
              W
            </th>
            <th
              scope="col"
              className={cn(th, "hidden text-right sm:table-cell")}
              title="Games played (with 2+ players)"
            >
              GP
            </th>
            <th scope="col" className={cn(th, "text-right")} title="Average points per game played">
              Avg
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const me = r.memberId === meId;
            const leader = leaderLabel && anyPoints && r.rank === 1 && r.points > 0;
            return (
              <motion.tr
                key={r.memberId}
                layout="position"
                transition={{ type: "spring", stiffness: 500, damping: 42 }}
                className={cn("border-b last:border-b-0", me && "bg-accent-soft")}
                data-testid={`standing-${r.name}`}
                aria-current={me ? "true" : undefined}
              >
                <td className={cn("px-2 py-3", me && "shadow-[inset_3px_0_0_var(--accent)]")}>
                  <RankBadge rank={r.points > 0 || r.played > 0 ? r.rank : null} />
                </td>
                <td className="max-w-[11rem] px-2 py-3">
                  <Link
                    href={`/l/${slug}/p/${r.memberId}`}
                    className="flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
                  >
                    <span className="truncate">{r.name}</span>
                    {me && <span className="text-muted-foreground text-xs font-normal"> you</span>}
                  </Link>
                  {leader && (
                    <span className="text-gold mt-0.5 flex items-center gap-1 text-xs font-semibold">
                      <Crown className="size-3.5" aria-hidden /> {leaderLabel}
                    </span>
                  )}
                </td>
                <td className="num px-2 py-3 text-right text-2xl leading-none font-bold">
                  {r.points}
                </td>
                <td className="num px-2 py-3 text-right text-base">{r.wins}</td>
                <td className="num hidden px-2 py-3 text-right text-base sm:table-cell">
                  {r.played}
                </td>
                <td className="num text-muted-foreground px-2 py-3 text-right text-base">
                  {r.played ? r.avg.toFixed(2) : "–"}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
