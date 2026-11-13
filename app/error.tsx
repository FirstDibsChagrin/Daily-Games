"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main
      id="main"
      role="alert"
      className="mx-auto mt-20 flex max-w-md flex-col items-center gap-3 p-8 text-center"
    >
      <AlertTriangle className="text-warning size-10" aria-hidden />
      <h1 className="font-display text-xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">Please try again in a moment.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
