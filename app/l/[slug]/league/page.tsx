import { ChevronRight, Crown, Gamepad2, Inbox, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { GameDot, PageTitle } from "@/components/league/bits";
import { CopyButton, ShareButton } from "@/components/league/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const creator = members.find((m) => m.is_creator);
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
          {me.isCreator && (
            <Card className="glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="text-gold size-5" aria-hidden /> Creator tools
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                <Button asChild variant="outline" className="justify-between">
                  <Link href={`/l/${slug}/settings/games`}>
                    <span className="flex items-center gap-2">
                      <Gamepad2 /> Manage games
                    </span>
                    {pending > 0 ? (
                      <Badge>
                        <Inbox className="size-3" aria-hidden /> {pending} new
                      </Badge>
                    ) : (
                      <ChevronRight />
                    )}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-between">
                  <Link href={`/l/${slug}/settings`}>
                    <span className="flex items-center gap-2">
                      <Settings /> League settings
                    </span>
                    <ChevronRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Invite friends</CardTitle>
              <CardDescription>
                {me.isCreator
                  ? "Share the code or link. Friends pick a name and a PIN."
                  : `Ask ${creator?.name ?? "the league creator"} for the join code.`}
              </CardDescription>
            </CardHeader>
            {me.isCreator && (
              <CardContent className="grid gap-3">
                <div className="bg-background/50 flex items-center justify-between gap-3 rounded-lg border p-3">
                  <span
                    className="num text-3xl font-bold tracking-[0.25em]"
                    data-testid="join-code"
                  >
                    {league.join_code}
                  </span>
                  <CopyButton text={league.join_code} label="Copy code" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1.5 text-xs">
                    {joinUrl}
                  </code>
                  <CopyButton text={joinUrl} label="Copy link" />
                  <ShareButton url={joinUrl} title={league.name} />
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Players</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1">
                {members.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/l/${slug}/p/${m.id}`}
                      className="hover:bg-muted flex items-center gap-3 rounded-lg px-2 py-2"
                    >
                      <span className="bg-accent-soft font-display text-accent flex size-8 items-center justify-center rounded-full font-bold">
                        {m.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="flex-1 font-medium">
                        {m.name}
                        {m.id === me.memberId && (
                          <span className="text-accent ml-1 text-xs">(you)</span>
                        )}
                      </span>
                      {m.is_creator && (
                        <span className="text-gold flex items-center gap-1 text-xs">
                          <Crown className="size-3.5" aria-hidden /> Creator
                        </span>
                      )}
                      <ChevronRight className="text-muted-foreground size-4" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
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
                <ul className="grid gap-2">
                  {activeGames.map((g) => (
                    <li key={g.id} className="flex items-start gap-2 text-sm">
                      <GameDot color={g.color} className="mt-1" />
                      <span>
                        <span className="font-semibold">{g.name}</span>{" "}
                        <span className="text-muted-foreground">
                          · {g.direction === "lower_is_better" ? "lower wins" : "higher wins"}
                        </span>
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
