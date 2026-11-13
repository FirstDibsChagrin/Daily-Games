"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/ui/select";

export function GameFilter({
  games,
  value,
}: {
  games: { id: string; name: string }[];
  value: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <NativeSelect
      aria-label="Filter by game"
      className="w-full sm:w-60"
      value={value ?? ""}
      onChange={(e) => {
        const p = new URLSearchParams(sp.toString());
        if (e.target.value) p.set("game", e.target.value);
        else p.delete("game");
        router.push(`${pathname}?${p.toString()}`);
      }}
    >
      <option value="">All games</option>
      {games.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </NativeSelect>
  );
}
