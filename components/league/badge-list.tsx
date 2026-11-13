import { BADGE_BY_KEY } from "@/lib/scoring/badges";
import { formatShort, type PlainDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function BadgeChip({
  badgeKey,
  earnedOn,
  detail,
  className,
}: {
  badgeKey: string;
  earnedOn?: PlainDate;
  detail?: string | null;
  className?: string;
}) {
  const b = BADGE_BY_KEY.get(badgeKey);
  if (!b) return null;
  return (
    <div
      className={cn(
        "from-accent-soft flex items-center gap-3 rounded-xl border bg-gradient-to-br to-transparent p-3",
        className,
      )}
      data-testid={`badge-${badgeKey}`}
    >
      <span className="text-2xl" aria-hidden>
        {b.icon}
      </span>
      <div className="min-w-0">
        <p className="font-display leading-tight font-semibold">{b.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {detail ?? b.description}
          {earnedOn && ` · ${formatShort(earnedOn)}`}
        </p>
      </div>
    </div>
  );
}
