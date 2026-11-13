import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  isCurrentPeriod,
  periodLabel,
  shiftPeriod,
  type Period,
  type PeriodKind,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

const KINDS: { kind: PeriodKind; label: string }[] = [
  { kind: "day", label: "Day" },
  { kind: "week", label: "Week" },
  { kind: "month", label: "Month" },
  { kind: "all", label: "All-time" },
];

export function PeriodNav({
  period,
  today,
  hrefFor,
}: {
  period: Period;
  today: string;
  hrefFor: (kind: PeriodKind, anchor: string | null) => string;
}) {
  const prev = shiftPeriod(period, -1);
  const next = shiftPeriod(period, 1);
  const atCurrent = isCurrentPeriod(period, today);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Period" className="bg-muted flex rounded-lg p-1">
        {KINDS.map((k) => (
          <Link
            key={k.kind}
            href={hrefFor(k.kind, null)}
            aria-current={period.kind === k.kind ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
              period.kind === k.kind
                ? "bg-card text-foreground shadow"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k.label}
          </Link>
        ))}
      </nav>
      {period.kind !== "all" && (
        <div className="flex items-center gap-1">
          <Link
            href={hrefFor(period.kind, prev.anchor)}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-2"
            aria-label="Previous"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span
            className="font-display min-w-36 text-center text-sm font-semibold"
            aria-live="polite"
          >
            {periodLabel(period, today)}
          </span>
          {atCurrent ? (
            <span className="text-muted-foreground/30 p-2" aria-hidden>
              <ChevronRight className="size-4" />
            </span>
          ) : (
            <Link
              href={hrefFor(period.kind, next.anchor)}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-2"
              aria-label="Next"
            >
              <ChevronRight className="size-4" />
            </Link>
          )}
          {!atCurrent && (
            <Link
              href={hrefFor(period.kind, null)}
              className="text-accent ml-1 text-xs font-semibold hover:underline"
            >
              Current
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
