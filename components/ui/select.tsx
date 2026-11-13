import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Styled native <select> (best on phones). */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="border-input bg-background/60 focus-visible:border-ring focus-visible:ring-ring/40 h-10 w-full cursor-pointer appearance-none rounded-lg border pr-9 pl-3 text-base outline-none focus-visible:ring-2 md:text-sm"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
      />
    </div>
  );
}

export { NativeSelect };
