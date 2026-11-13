import { ChevronRight, Crown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { GameDot, PageTitle } from "@/components/league/bits";
import { CopyButton, ShareButton } from "@/components/league/copy-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/server/db";
import { requireLeague } from "@/lib/server/league";
import { siteOrigin } from "@/lib/server/origin";
import { AccountCard, SuggestForm } from "./league-forms";

export const metadata: Metadata = { title: "League" };

export default async function LeaguePage({ params }: PageProps<"/l/[slug]/league">) {
  const { slug } = await params;
  const { league, members, me, activeGames } = await requireLeague(slug);
  const origin = await siteOrigin();
  const joinUrl = `${origin}/join/${league.join_code}`;
  const [{ n: pending }] = await db()<{ n: number }[]>`
    select count(*)::int as n from game_suggestions where league_id = ${league.id} and status = 'pending'`;

  return (
    <>
      <PageTitle
        title={league.name}
        subtitle={`${members.length} players · ${activeGames.length} games`}
      />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-4">
          {/* Invite: every member can see and share the join code */}
          <Card>
            <CardHeader>
              <CardTitle>Invite friends</CardTitle>
              <CardDescription>
                Share the code or the link. Friends pick a name and a 4-digit PIN.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className="font-mono text-[2rem] leading-none font-semibold tracking-[0.18em]"
                  data-testid="join-code"
                  aria-label={`Join code ${league.join_code.split("").join(" ")}`}
                >
                  {league.join_code}
                </span>
                <div className="flex flex-wrap gap-2">
                  <CopyButton text={league.join_code} label="Copy code" />
                  <ShareButton url={joinUrl} title={league.name} />
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-2 border-t pt-3">
                <code className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                  {joinUrl}
                </code>
                <CopyButton text={joinUrl} label="Copy link" />
              </div>
            </CardContent>
          </Card>

          {me.isCreator && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="text-gold size-4" aria-hidden /> Run the league
                </CardTitle>
              </CardHeader>
              <ul className="divide-y border-t">
                <li>
                  <Link
                    href={`/l/${slug}/settings/games`}
                    className="hover:bg-muted/60 flex min-h-14 items-center gap-3 px-4 sm:px-5"
                  >
                    <span className="flex-1">
                      <span className="block font-semibold">Manage games</span>
                      <span className="text-muted-foreground text-sm">
                        Add, edit, reorder, archive, review suggestions
                      </span>
                    </span>
                    {pending > 0 && <Badge>{pending} new</Badge>}
                    <ChevronRight className="text-muted-foreground size-4" aria-hidden />
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/l/${slug}/settings`}
                    className="hover:bg-muted/60 flex min-h-14 items-center gap-3 px-4 sm:px-5"
                  >
                    <span className="flex-1">
                      <span className="block font-semibold">League settings</span>
                      <span className="text-muted-foreground text-sm">
                        Name, join code, points table, members
                      </span>
                    </span>
                    <ChevronRight className="text-muted-foreground size-4" aria-hidden />
                  </Link>
                </li>
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Players</CardTitle>
            </CardHeader>
            <ul className="divide-y border-t">
              {members.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/l/${slug}/p/${m.id}`}
                    className="hover:bg-muted/60 flex min-h-12 items-center gap-3 px-4 sm:px-5"
                  >
                    <span className="flex-1 font-medium">
                      {m.name}
                      {m.id === me.memberId && (
                        <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                          {" "}
                          you
                        </span>
                      )}
                    </span>
                    {m.is_creator && (
                      <span className="text-gold flex items-center gap-1 text-xs font-medium">
                        <Crown className="size-3.5" aria-hidden /> Creator
                      </span>
                    )}
                    <ChevronRight className="text-muted-foreground size-4" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Games we play</CardTitle>
            </CardHeader>
            <CardContent>
              {activeGames.length === 0 ? (
                <p className="text-muted-foreground text-sm">No games yet.</p>
              ) : (
                <ul className="grid gap-2.5">
                  {activeGames.map((g) => (
                    <li key={g.id} className="flex items-center gap-2.5 text-[15px]">
                      <GameDot color={g.color} />
                      <span className="font-semibold">{g.name}</span>
                      <span className="text-muted-foreground text-sm">
                        {g.direction === "lower_is_better" ? "lower wins" : "higher wins"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card id="suggest" className="scroll-mt-20">
            <CardHeader>
              <CardTitle>Suggest a game</CardTitle>
              <CardDescription>
                {me.isCreator
                  ? "You can add games directly from Manage games."
                  : "Know a daily game the league should play? The creator will review it."}
              </CardDescription>
            </CardHeader>
            {!me.isCreator && (
              <CardContent>
                <SuggestForm slug={slug} />
              </CardContent>
            )}
          </Card>
          <AccountCard slug={slug} name={me.memberName} />
        </div>
      </div>
    </>
  );
}
