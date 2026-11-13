import { ChevronRight, Crown, Plus, Users } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMemberships } from "@/lib/server/session";

export default async function HomePage() {
  const leagues = await getMemberships();
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-16">
        <section className="py-8 sm:py-14">
          <p className="font-display text-accent text-sm font-semibold tracking-[0.2em] uppercase">
            Wordle · Connections · and friends
          </p>
          <h1 className="font-display mt-2 text-4xl leading-[1.05] font-bold sm:text-6xl">
            Your daily puzzles,
            <br />
            now a <span className="text-accent">league</span>.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-lg">
            Log scores in seconds, climb the standings, and crown a champion every week. No
            accounts, just a join code and a 4-digit PIN.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/create">
                <Plus /> Create league
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/join">
                <Users /> Join league
              </Link>
            </Button>
          </div>
        </section>

        <section aria-labelledby="my-leagues">
          <h2 id="my-leagues" className="font-display mb-3 text-xl font-semibold">
            My leagues
          </h2>
          {leagues.length === 0 ? (
            <Card className="text-muted-foreground p-6">
              <p>
                This device isn&apos;t in any leagues yet. Create one, or join with a code from a
                friend.
              </p>
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {leagues.map((l) => (
                <li key={l.leagueId}>
                  <Link href={`/l/${l.slug}/today`} className="group block rounded-xl">
                    <Card className="group-hover:border-ring/60 flex items-center gap-4 p-4 transition-colors">
                      <div className="bg-accent-soft font-display text-accent flex size-12 items-center justify-center rounded-lg text-xl font-bold">
                        {l.leagueName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display truncate text-lg font-semibold">
                          {l.leagueName}
                        </p>
                        <p className="text-muted-foreground flex items-center gap-1 text-sm">
                          Playing as{" "}
                          <span className="text-foreground font-medium">{l.memberName}</span>
                          {l.isCreator && (
                            <Crown className="text-gold size-3.5" aria-label="creator" />
                          )}
                        </p>
                      </div>
                      <ChevronRight className="text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
