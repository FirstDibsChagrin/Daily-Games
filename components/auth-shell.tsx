import { SiteHeader } from "@/components/site-header";

/** Narrow single-column layout for create / join screens. */
export function AuthShell({
  title,
  kicker,
  description,
  children,
}: {
  title: string;
  kicker?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-md px-4 pt-8 pb-16 sm:pt-12">
        {kicker && <p className="kicker text-accent mb-1">{kicker}</p>}
        <h1 className="font-display text-4xl leading-none font-bold">{title}</h1>
        {description && <div className="text-muted-foreground mt-2">{description}</div>}
        <div className="mt-6 border-t pt-6">{children}</div>
      </main>
    </>
  );
}
