import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <defs>
        <linearGradient id="dl-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#dl-g)" />
      <rect x="7" y="17" width="4.5" height="8" rx="1.2" fill="#fff" opacity=".75" />
      <rect x="13.75" y="8" width="4.5" height="17" rx="1.2" fill="#fff" />
      <rect x="20.5" y="13" width="4.5" height="12" rx="1.2" fill="#fff" opacity=".9" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 rounded-md", className)}>
      <LogoMark />
      <span className="font-display text-lg font-bold tracking-wide">
        DAILY<span className="text-accent">LEAGUE</span>
      </span>
    </Link>
  );
}
