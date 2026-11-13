"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LeagueError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-xl border p-8 text-center"
    >
      <AlertTriangle className="text-warning size-10" aria-hidden />
      <h1 className="font-display text-xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">
        We couldn&apos;t load this page. Check your connection and try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
