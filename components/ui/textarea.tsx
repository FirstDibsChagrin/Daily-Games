import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input bg-background/60 placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-ring/40 flex min-h-20 w-full rounded-lg border px-3 py-2 text-base outline-none focus-visible:ring-2 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
