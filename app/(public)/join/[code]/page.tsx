import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CODE_RE, normalizeCode } from "@/lib/codes";
import { db } from "@/lib/server/db";
import { hit, lockedFor, lockMessage, RULES } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";
import { getMemberships } from "@/lib/server/session";
import { JoinForms } from "./join-forms";

export const metadata: Metadata = { title: "Join a league" };

export default async function JoinCodePage({ params }: PageProps<"/join/[code]">) {
  const code = normalizeCode((await params).code);
  const ip = await clientIp();
  const key = `code:${ip}`;
  const locked = await lockedFor(key);

  let league: { id: string; name: string; slug: string } | undefined;
  let error: string | null = null;
  if (locked) error = lockMessage(locked);
  else if (!CODE_RE.test(code)) error = "That doesn't look like a join code.";
  else {
    [league] = await db()<{ id: string; name: string; slug: string }[]>`
      select id, name, slug from leagues where join_code = ${code}`;
    if (!league) {
      const lock = await hit(key, RULES.joinCode);
      error = lock
        ? lockMessage(lock)
        : "No league has that code. It may have been changed — ask for the current one.";
    }
  }

  if (!league) {
    return (
      <>
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-md px-4 pb-16">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Can&apos;t find that league</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/join">Enter a different code</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  const me = (await getMemberships()).find((m) => m.leagueId === league.id);
  const members = await db()<{ id: string; name: string }[]>`
    select id, name from members where league_id = ${league.id} order by lower(name)`;

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-md px-4 pb-16">
        <Card>
          <CardHeader>
            <p className="text-accent text-sm font-semibold tracking-widest uppercase">
              You&apos;re invited to
            </p>
            <CardTitle className="text-3xl">{league.name}</CardTitle>
            <CardDescription>
              {members.length} {members.length === 1 ? "player" : "players"} so far
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {me && (
              <div className="border-ring/40 bg-accent-soft rounded-lg border p-3 text-sm">
                This device is already in this league as <strong>{me.memberName}</strong>.{" "}
                <Link
                  className="text-accent font-semibold underline"
                  href={`/l/${league.slug}/today`}
                >
                  Go to the league
                </Link>
              </div>
            )}
            <JoinForms code={code} members={members} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
