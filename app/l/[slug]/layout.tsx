import { BottomTabs, TopNav } from "@/components/league/nav";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { requireLeague } from "@/lib/server/league";

export default async function LeagueLayout({ children, params }: LayoutProps<"/l/[slug]">) {
  const { slug } = await params;
  const { league, me } = await requireLeague(slug);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur-lg">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
          <Link href="/" aria-label="All my leagues" className="rounded-md">
            <LogoMark />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-base leading-tight font-semibold">
              {league.name}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              as <span className="text-foreground font-medium">{me.memberName}</span>
            </p>
          </div>
          <TopNav slug={slug} />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-28 md:pb-12">{children}</main>
      <BottomTabs slug={slug} />
    </div>
  );
}
