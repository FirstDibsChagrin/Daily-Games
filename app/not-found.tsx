import Link from "@/components/app-link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 p-8 text-center"
      >
        <p className="font-display text-accent text-6xl font-bold">404</p>
        <h1 className="font-display text-xl font-bold">Page not found</h1>
        <p className="text-muted-foreground text-sm">
          That page doesn&apos;t exist (or the link is out of date).
        </p>
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
      </main>
    </>
  );
}
