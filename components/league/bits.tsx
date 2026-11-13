import { cn } from "@/lib/utils";

export function GameDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3 shrink-0 rounded-full ring-2 ring-white/10", className)}
      style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}66` }}
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

const MEDALS = ["🥇", "🥈", "🥉"];
const ORD = ["1st", "2nd", "3rd"];

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

/** Rank with a medal for 1–3; text label is always present (never color alone). */
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
          "num text-muted-foreground inline-flex w-9 justify-center text-sm",
          className,
        )}
        aria-label="did not finish"
      >
        —
      </span>
    );
  }
  if (rank <= 3) {
    return (
      <span
        className={cn("inline-flex w-9 items-center justify-center text-lg", className)}
        title={ORD[rank - 1]}
      >
        <span aria-hidden>{MEDALS[rank - 1]}</span>
        <span className="sr-only">{ORD[rank - 1]}</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "num text-muted-foreground inline-flex w-9 justify-center text-sm font-semibold",
        className,
      )}
    >
      {ordinal(rank)}
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
        "flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center",
        className,
      )}
    >
      {icon && (
        <div className="text-3xl" aria-hidden>
          {icon}
        </div>
      )}
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <div className="text-muted-foreground max-w-sm text-sm">{children}</div>}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <div className="text-muted-foreground mt-0.5 text-sm">{subtitle}</div>}
      </div>
      {actions}
    </div>
  );
}
