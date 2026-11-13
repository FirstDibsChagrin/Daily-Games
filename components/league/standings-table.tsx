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
  /** e.g. "Current leader" or "Champion" for rank-1 rows */
  leaderLabel?: string | null;
  caption: string;
}) {
  const anyPoints = rows.some((r) => r.points > 0);
  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-separate border-spacing-y-1.5 text-sm"
        data-testid="standings"
      >
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-muted-foreground text-left text-xs tracking-wider uppercase">
            <th scope="col" className="w-12 px-2 font-semibold">
              #
            </th>
            <th scope="col" className="px-2 font-semibold">
              Player
            </th>
            <th scope="col" className="px-2 text-right font-semibold">
              Pts
            </th>
            <th scope="col" className="px-2 text-right font-semibold" title="1st-place finishes">
              Wins
            </th>
            <th
              scope="col"
              className="hidden px-2 text-right font-semibold sm:table-cell"
              title="Games played (with 2+ players)"
            >
              Played
            </th>
            <th
              scope="col"
              className="px-2 text-right font-semibold"
              title="Average points per game played"
            >
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
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                className={cn(
                  "[&>td]:bg-card/80 [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg",
                  me && "[&>td]:bg-accent-soft",
                )}
                data-testid={`standing-${r.name}`}
                aria-current={me ? "true" : undefined}
              >
                <td className={cn("px-2 py-2.5", me && "shadow-[inset_3px_0_0_var(--ring)]")}>
                  <RankBadge rank={r.points > 0 || r.played > 0 ? r.rank : null} />
                </td>
                <td className="max-w-[10rem] px-2 py-2.5">
                  <Link
                    href={`/l/${slug}/p/${r.memberId}`}
                    className="flex items-center gap-1.5 font-semibold hover:underline"
                  >
                    <span className="truncate">{r.name}</span>
                    {me && <span className="text-accent text-xs font-normal">(you)</span>}
                  </Link>
                  {leader && (
                    <span className="text-gold mt-0.5 flex items-center gap-1 text-xs font-semibold">
                      <Crown className="size-3" aria-hidden /> {leaderLabel}
                    </span>
                  )}
                </td>
                <td className="num px-2 py-2.5 text-right text-xl font-bold">{r.points}</td>
                <td className="num px-2 py-2.5 text-right">{r.wins}</td>
                <td className="num hidden px-2 py-2.5 text-right sm:table-cell">{r.played}</td>
                <td className="num text-muted-foreground px-2 py-2.5 text-right">
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
