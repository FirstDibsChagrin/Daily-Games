import { cn } from "@/lib/utils";

/** Team-color swatch for a game. Never the only signal: always next to the name. */
export function GameDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-[2px]", className)}
      style={{ backgroundColor: color }}
    />
  );
}

export function GameName({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <GameDot color={color} />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function ordinal(n: number): string {
  const s = n % 100;
  if (s >= 11 && s <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

const PODIUM = [
  "bg-gold-soft text-gold border-gold/50",
  "bg-silver-soft text-silver border-silver/40",
  "bg-bronze-soft text-bronze border-bronze/45",
];

/** Rank chip. Podium places get a tinted chip; the numeral is always shown (never color alone). */
export function RankBadge({
  rank,
  failed,
  className,
}: {
  rank: number | null;
  failed?: boolean;
  className?: string;
}) {
  if (failed || rank === null) {
    return (
      <span
        className={cn(
          "num text-muted-foreground inline-flex w-7 justify-center text-base",
          className,
        )}
        aria-label="did not finish"
      >
        –
      </span>
    );
  }
  return (
    <span
      className={cn(
        "num inline-flex h-6 min-w-7 items-center justify-center rounded-sm px-1 text-[15px] leading-none font-bold",
        rank <= 3 ? cn("border", PODIUM[rank - 1]) : "text-muted-foreground",
        className,
      )}
      title={`${ordinal(rank)} place`}
    >
      <span aria-hidden>{rank}</span>
      <span className="sr-only">{ordinal(rank)}</span>
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-md border px-5 py-8 sm:items-center sm:text-center",
        className,
      )}
    >
      {icon && (
        <div className="text-muted-foreground [&_svg]:size-7" aria-hidden>
          {icon}
        </div>
      )}
      <p className="font-display text-xl font-bold">{title}</p>
      {children && <div className="text-muted-foreground max-w-sm text-sm">{children}</div>}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  actions,
  kicker,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  kicker?: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      <div className="min-w-0">
        {kicker && <p className="kicker text-accent mb-1">{kicker}</p>}
        <h1 className="font-display text-[2rem] leading-none font-bold sm:text-[2.5rem]">
          {title}
        </h1>
        {subtitle && <div className="text-muted-foreground mt-1.5 text-sm">{subtitle}</div>}
      </div>
      {actions}
    </div>
  );
}
