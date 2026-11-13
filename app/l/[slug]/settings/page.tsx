import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/league/bits";
import { requireLeague } from "@/lib/server/league";
import { siteOrigin } from "@/lib/server/origin";
import { SettingsPanels } from "./settings-panels";

export const metadata: Metadata = { title: "League settings" };

export default async function SettingsPage({ params }: PageProps<"/l/[slug]/settings">) {
  const { slug } = await params;
  const { league, members, me } = await requireLeague(slug);
  if (!me.isCreator) redirect(`/l/${slug}/league`);
  return (
    <>
      <Link
        href={`/l/${slug}/league`}
        className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> League
      </Link>
      <PageTitle title="League settings" />
      <SettingsPanels
        slug={slug}
        origin={await siteOrigin()}
        league={{ name: league.name, joinCode: league.join_code, pointsTable: league.points_table }}
        members={members.map((m) => ({ id: m.id, name: m.name, isCreator: m.is_creator }))}
        meId={me.memberId}
      />
    </>
  );
}
