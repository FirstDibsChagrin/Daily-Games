"use client";

import { BarChart3, CalendarCheck, Settings2, Trophy } from "lucide-react";
import Link from "@/components/app-link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { seg: "today", label: "Today", icon: CalendarCheck, match: ["today"] },
  { seg: "standings", label: "Standings", icon: Trophy, match: ["standings", "day"] },
  { seg: "stats", label: "Stats", icon: BarChart3, match: ["stats", "p", "champions", "recap"] },
  { seg: "league", label: "League", icon: Settings2, match: ["league", "settings"] },
];

function useActive(slug: string) {
  const path = usePathname();
  const seg = path.split("/")[3] ?? "today";
  return (match: string[]) =>
    match.includes(seg) || (path === `/l/${slug}` && match[0] === "today");
}

export function TopNav({ slug }: { slug: string }) {
  const isActive = useActive(slug);
  return (
    <nav aria-label="League" className="hidden h-full items-stretch md:flex">
      {TABS.map((t) => {
        const active = isActive(t.match);
        return (
          <Link
            key={t.seg}
            href={`/l/${slug}/${t.seg}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "font-display flex items-center border-b-2 px-3.5 text-[15px] font-semibold tracking-wide uppercase transition-colors",
              active
                ? "border-accent text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomTabs({ slug }: { slug: string }) {
  const isActive = useActive(slug);
  return (
    <nav
      aria-label="League"
      className="bg-background pb-safe fixed inset-x-0 bottom-0 z-40 border-t md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((t) => {
          const active = isActive(t.match);
          return (
            <li key={t.seg}>
              <Link
                href={`/l/${slug}/${t.seg}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {active && (
                  <span aria-hidden className="bg-accent absolute inset-x-6 top-0 h-0.5" />
                )}
                <t.icon className="size-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
