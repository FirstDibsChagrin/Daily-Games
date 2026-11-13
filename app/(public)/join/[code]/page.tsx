import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
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
        : "No league has that code. It may have been changed, so ask for the current one.";
    }
  }

  if (!league) {
    return (
      <AuthShell title="Can't find that league" description={error}>
        <Button asChild variant="outline">
          <Link href="/join">Enter a different code</Link>
        </Button>
      </AuthShell>
    );
  }

  const me = (await getMemberships()).find((m) => m.leagueId === league.id);
  const members = await db()<{ id: string; name: string }[]>`
    select id, name from members where league_id = ${league.id} order by lower(name)`;

  return (
    <AuthShell
      kicker="You're invited to"
      title={league.name}
      description={`${members.length} ${members.length === 1 ? "player" : "players"} so far`}
    >
      {me && (
        <p className="bg-accent-soft mb-5 rounded-md border px-3 py-2.5 text-sm">
          This device is already in this league as <strong>{me.memberName}</strong>.{" "}
          <Link className="text-accent font-semibold underline" href={`/l/${league.slug}/today`}>
            Go to the league
          </Link>
        </p>
      )}
      <JoinForms code={code} members={members} />
    </AuthShell>
  );
}
