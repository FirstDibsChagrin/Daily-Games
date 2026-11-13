"use client";

import { useState, useTransition } from "react";
import { findLeague } from "@/app/actions/identity";
import { FormError } from "@/components/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeCode } from "@/lib/codes";

export function CodeForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await findLeague({ code });
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="code">Join code</Label>
        <Input
          id="code"
          required
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={8}
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          placeholder="K7QX2M"
          className="num h-14 text-center text-2xl tracking-[0.35em] uppercase"
        />
      </div>
      <FormError message={error} />
      <Button type="submit" size="lg" disabled={pending || code.length < 6}>
        {pending ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
