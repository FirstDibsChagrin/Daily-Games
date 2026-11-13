import { ArrowRight, Crown } from "lucide-react";
import Link from "next/link";
import { RankBadge } from "@/components/league/bits";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getMemberships } from "@/lib/server/session";

const SAMPLE = [
  { name: "Cara", wordle: "3", conn: "0", pts: 10 },
  { name: "Jack", wordle: "3", conn: "2", pts: 7 },
  { name: "TJ", wordle: "4", conn: "1", pts: 6 },
  { name: "Dev", wordle: "X", conn: "3", pts: 2 },
];

export default async function HomePage() {
  const leagues = await getMemberships();
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-16">
        <section className="grid gap-10 border-b py-10 sm:py-14 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <h1 className="font-display text-[2.75rem] leading-[0.95] font-bold sm:text-6xl">
              Keep score on the
              <br />
              daily puzzles.
            </h1>
            <p className="text-muted-foreground mt-4 max-w-md text-[17px] leading-relaxed">
              Log Wordle, Connections and the rest in a couple of taps. Points every day, a champion
              every Sunday night. No accounts, just a join code and a 4-digit PIN.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/create">Create a league</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/join">Join with a code</Link>
              </Button>
            </div>
          </div>

          {/* A small, real-looking box score */}
          <figure
            aria-label="Example of a day's results"
            className="bg-card hidden rounded-md border md:block"
          >
            <figcaption className="flex items-baseline justify-between border-b px-4 py-3">
              <span className="kicker">Tue, Nov 10</span>
              <span className="text-muted-foreground text-xs">Final</span>
            </figcaption>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-rule text-muted-foreground border-b text-left">
                  <th className="kicker px-4 py-2 text-[12px]">Player</th>
                  <th className="kicker px-2 py-2 text-right text-[12px]">Wordle</th>
                  <th className="kicker px-2 py-2 text-right text-[12px]">Conn.</th>
                  <th className="kicker px-4 py-2 text-right text-[12px]">Pts</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE.map((r, i) => (
                  <tr key={r.name} className="border-b last:border-b-0">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 font-semibold">
                        <RankBadge rank={i + 1} />
                        {r.name}
                      </span>
                    </td>
                    <td className="num px-2 text-right text-base">{r.wordle}</td>
                    <td className="num px-2 text-right text-base">{r.conn}</td>
                    <td className="num px-4 text-right text-xl font-bold">{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        </section>

        <section aria-labelledby="my-leagues" className="pt-8">
          <h2 id="my-leagues" className="kicker text-muted-foreground mb-3">
            Your leagues on this device
          </h2>
          {leagues.length === 0 ? (
            <p className="text-muted-foreground max-w-md">
              None yet. Create one, or ask a friend for their league&apos;s join code.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {leagues.map((l) => (
                <li key={l.leagueId}>
                  <Link
                    href={`/l/${l.slug}/today`}
                    className="hover:bg-muted/60 group flex min-h-16 items-center gap-4 px-4 py-3 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-display truncate text-xl leading-tight font-bold">
                        {l.leagueName}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1 text-sm">
                        Playing as{" "}
                        <span className="text-foreground font-medium">{l.memberName}</span>
                        {l.isCreator && (
                          <span className="text-gold ml-1 inline-flex items-center gap-0.5 text-xs">
                            <Crown className="size-3.5" aria-hidden /> creator
                          </span>
                        )}
                      </p>
                    </div>
                    <ArrowRight
                      className="text-muted-foreground size-5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
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
