"use client";

import { BarChart3, CalendarCheck, Settings2, Trophy } from "lucide-react";
import Link from "next/link";
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
    <nav aria-label="League" className="hidden items-center gap-1 md:flex">
      {TABS.map((t) => {
        const active = isActive(t.match);
        return (
          <Link
            key={t.seg}
            href={`/l/${slug}/${t.seg}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-accent-soft text-accent"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <t.icon className="size-4" aria-hidden />
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
      className="bg-background/90 pb-safe fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-lg md:hidden"
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
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors",
                  active ? "text-accent" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-accent-soft",
                  )}
                >
                  <t.icon className="size-5" aria-hidden />
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
