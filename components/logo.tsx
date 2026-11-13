import Link from "next/link";
import { cn } from "@/lib/utils";

/** Monogram: a scoreboard tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-primary text-primary-foreground font-display grid size-8 shrink-0 place-items-center rounded-sm text-[15px] leading-none font-bold tracking-tight",
        className,
      )}
    >
      DL
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 rounded-sm", className)}>
      <LogoMark />
      <span className="font-display text-xl leading-none font-bold tracking-wide uppercase">
        Daily League
      </span>
    </Link>
  );
}
