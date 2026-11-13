import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "@/components/app-link";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/league/bits";
import { CATALOG } from "@/lib/catalog-data";
import { db } from "@/lib/server/db";
import { requireLeague } from "@/lib/server/league";
import { GamesManager } from "./games-manager";

export const metadata: Metadata = { title: "Games" };

export default async function GamesSettingsPage({
  params,
  searchParams,
}: PageProps<"/l/[slug]/settings/games">) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireLeague(slug);
  if (!ctx.me.isCreator) redirect(`/l/${slug}/league`);

  const sql = db();
  const [counts, suggestions] = await Promise.all([
    sql<{ game_id: string; n: number }[]>`
      select game_id, count(*)::int as n from scores where league_id = ${ctx.league.id} group by game_id`,
    sql<
      {
        id: string;
        name: string;
        url: string | null;
        description: string;
        created_at: Date;
        member_name: string | null;
      }[]
    >`
      select s.id, s.name, s.url, s.description, s.created_at, m.name as member_name
      from game_suggestions s left join members m on m.id = s.member_id
      where s.league_id = ${ctx.league.id} and s.status = 'pending' order by s.created_at`,
  ]);
  // The catalog comes straight from code (lib/catalog-data.ts), so new games appear on deploy.
  const catalog = CATALOG;
  const scoreCounts = Object.fromEntries(counts.map((c) => [c.game_id, c.n]));

  return (
    <>
      <Link
        href={`/l/${slug}/league`}
        className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> League
      </Link>
      <PageTitle
        title="Games"
        subtitle="Choose what your league plays. Changes apply to everyone right away."
      />
      {sp.welcome && (
        <div className="border-ring/40 bg-accent-soft mb-4 rounded-md border p-4">
          <p className="font-display text-lg font-semibold">Your league is ready</p>
          <p className="text-muted-foreground text-sm">
            Tick the games your group plays and tap <strong>Add selected</strong>. Then share your
            join code <span className="num text-foreground font-bold">{ctx.league.join_code}</span>{" "}
            from the League tab.
          </p>
        </div>
      )}
      <GamesManager
        slug={slug}
        games={ctx.games.map((g) => ({ ...g, archived: !!g.archived_at, archived_at: undefined }))}
        catalog={catalog}
        scoreCounts={scoreCounts}
        suggestions={suggestions.map((s) => ({ ...s, created_at: s.created_at.toISOString() }))}
      />
    </>
  );
}
