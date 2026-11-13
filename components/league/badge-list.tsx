import {
  Award,
  Crosshair,
  Flame,
  ListChecks,
  type LucideIcon,
  Medal,
  Sprout,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { formatShort, type PlainDate } from "@/lib/dates";
import { BADGE_BY_KEY } from "@/lib/scoring/badges";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  rookie: Sprout,
  century: Medal,
  streak_7: Flame,
  streak_30: Flame,
  streak_100: Flame,
  champ_1: Trophy,
  champ_3: Trophy,
  champ_5: Trophy,
  champ_10: Trophy,
  day_sweep: Zap,
  completionist: ListChecks,
  specialist: Crosshair,
  podium_regular: Award,
  comeback_kid: TrendingUp,
};

/** Tiered badges get a stronger treatment. */
const TIER: Record<string, string> = {
  streak_30: "text-warning border-warning/50",
  streak_100: "text-warning border-warning bg-warning/10",
  champ_1: "text-gold border-gold/50",
  champ_3: "text-gold border-gold/60 bg-gold-soft",
  champ_5: "text-gold border-gold bg-gold-soft",
  champ_10: "text-gold border-gold bg-gold-soft",
};

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
  const Icon = ICONS[badgeKey] ?? Award;
  return (
    <div
      className={cn("flex items-center gap-3 py-2.5", className)}
      data-testid={`badge-${badgeKey}`}
    >
      <span
        aria-hidden
        className={cn(
          "text-foreground grid size-10 shrink-0 place-items-center rounded-md border",
          TIER[badgeKey],
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="font-display text-base leading-tight font-bold">{b.name}</p>
        <p className="text-muted-foreground truncate text-[13px]">
          {detail ?? b.description}
          {earnedOn && <span className="num"> · {formatShort(earnedOn)}</span>}
        </p>
      </div>
    </div>
  );
}
