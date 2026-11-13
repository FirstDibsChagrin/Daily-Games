"use client";

import { AlertCircle } from "lucide-react";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function FormError({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn("text-destructive flex items-start gap-1.5 text-sm font-medium", className)}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

/** 4-digit PIN box: numeric keypad on phones, masked. */
export function PinInput(
  props: Omit<React.ComponentProps<typeof Input>, "type" | "inputMode" | "maxLength">,
) {
  return (
    <Input
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={4}
      autoComplete="off"
      placeholder="••••"
      {...props}
      onChange={(e) => {
        e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
        props.onChange?.(e);
      }}
      className={cn("w-32 text-center font-mono text-xl tracking-[0.4em]", props.className)}
    />
  );
}
