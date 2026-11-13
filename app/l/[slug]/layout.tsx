import Link from "next/link";
import { BottomTabs, TopNav } from "@/components/league/nav";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireLeague } from "@/lib/server/league";

export default async function LeagueLayout({ children, params }: LayoutProps<"/l/[slug]">) {
  const { slug } = await params;
  const { league, me } = await requireLeague(slug);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-background sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-stretch gap-3 px-4">
          <Link href="/" aria-label="All my leagues" className="flex items-center rounded-sm">
            <LogoMark />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="font-display truncate text-lg leading-tight font-bold">{league.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              Playing as <span className="text-foreground font-medium">{me.memberName}</span>
            </p>
          </div>
          <TopNav slug={slug} />
          <div className="flex items-center">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 md:pb-14">
        {children}
      </main>
      <BottomTabs slug={slug} />
    </div>
  );
}
