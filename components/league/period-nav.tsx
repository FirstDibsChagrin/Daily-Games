import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "@/components/app-link";
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
  const arrow =
    "text-muted-foreground hover:bg-muted hover:text-foreground grid size-11 place-items-center rounded-md";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <nav aria-label="Period" className="flex overflow-hidden rounded-md border">
        {KINDS.map((k) => (
          <Link
            key={k.kind}
            href={hrefFor(k.kind, null)}
            aria-current={period.kind === k.kind ? "page" : undefined}
            className={cn(
              "font-display flex h-11 items-center border-r px-3.5 text-[15px] font-semibold tracking-wide uppercase transition-colors last:border-r-0",
              period.kind === k.kind
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {k.label}
          </Link>
        ))}
      </nav>
      {period.kind !== "all" && (
        <div className="flex items-center">
          <Link href={hrefFor(period.kind, prev.anchor)} className={arrow} aria-label="Previous">
            <ChevronLeft className="size-5" />
          </Link>
          <span
            className="font-display min-w-32 text-center text-base font-semibold"
            aria-live="polite"
          >
            {periodLabel(period, today)}
          </span>
          {atCurrent ? (
            <span className="text-muted-foreground/30 grid size-11 place-items-center" aria-hidden>
              <ChevronRight className="size-5" />
            </span>
          ) : (
            <Link href={hrefFor(period.kind, next.anchor)} className={arrow} aria-label="Next">
              <ChevronRight className="size-5" />
            </Link>
          )}
          {!atCurrent && (
            <Link
              href={hrefFor(period.kind, null)}
              className="text-accent ml-1 text-sm font-semibold underline-offset-4 hover:underline"
            >
              Current
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
