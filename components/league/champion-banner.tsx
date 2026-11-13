import { Trophy } from "lucide-react";

/** Gold-ruled banner naming a week's champion(s). */
export function ChampionBanner({
  label,
  names,
  children,
  testId,
}: {
  label: string;
  names: string;
  children?: React.ReactNode;
  testId?: string;
}) {
  return (
    <section className="border-gold bg-gold-soft flex items-center gap-4 rounded-md border-l-4 px-4 py-4 sm:px-5">
      <Trophy className="text-gold size-9 shrink-0" strokeWidth={1.75} aria-hidden />
      <div className="min-w-0">
        <p className="kicker text-gold">{label}</p>
        <p className="font-display text-3xl leading-none font-bold" data-testid={testId}>
          {names}
        </p>
        {children && <div className="mt-1.5 text-sm">{children}</div>}
      </div>
    </section>
  );
}
