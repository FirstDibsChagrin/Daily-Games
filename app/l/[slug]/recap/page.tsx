import { Newspaper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageTitle } from "@/components/league/bits";
import { Card } from "@/components/ui/card";
import { formatWeek } from "@/lib/dates";
import { today as getToday } from "@/lib/server/clock";
import { loadInsights } from "@/lib/server/insights";
import { requireLeague } from "@/lib/server/league";

export const metadata: Metadata = { title: "Weekly recaps" };

export default async function RecapListPage({ params }: PageProps<"/l/[slug]/recap">) {
  const { slug } = await params;
  const ctx = await requireLeague(slug);
  const today = await getToday();
  const { weeks } = await loadInsights(ctx, today);
  const done = weeks.filter((w) => w.completed).reverse();
  return (
    <>
      <PageTitle
        title="Weekly recaps"
        subtitle="A recap is generated for every completed week (Mon–Sun, Eastern)."
      />
      {done.length === 0 ? (
        <EmptyState icon={<Newspaper />} title="No recaps yet">
          The first recap appears after Sunday at midnight Eastern.
        </EmptyState>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {done.map((w) => (
            <li key={w.weekStart}>
              <Link href={`/l/${slug}/recap/${w.weekStart}`} className="group block rounded-md">
                <Card className="group-hover:border-ring/60 p-4 transition-colors">
                  <p className="text-muted-foreground text-sm">{formatWeek(w.weekStart)}</p>
                  <p className="font-display text-lg font-semibold">
                    {w.champions.length
                      ? `Champion: ${w.champions.map((id) => ctx.memberName.get(id)).join(" & ")}`
                      : "No champion"}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
