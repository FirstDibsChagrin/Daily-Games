"use client";

import { useState, useTransition } from "react";
import { joinAsNew, reclaimMember } from "@/app/actions/identity";
import { FormError, PinInput } from "@/components/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function JoinForms({
  code,
  members,
}: {
  code: string;
  members: { id: string; name: string }[];
}) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [name, setName] = useState("");
  const [memberId, setMemberId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const tab = (m: "new" | "existing", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => {
        setMode(m);
        setError(null);
        setPin("");
      }}
      className={cn(
        "flex-1 cursor-pointer rounded-md px-3 py-2 text-sm font-semibold transition-colors",
        mode === m
          ? "bg-card text-foreground shadow"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="grid gap-4">
      {members.length > 0 && (
        <div
          role="tablist"
          aria-label="How are you joining?"
          className="bg-muted flex gap-1 rounded-lg p-1"
        >
          {tab("new", "I'm new here")}
          {tab("existing", "I've played before")}
        </div>
      )}
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (!/^\d{4}$/.test(pin)) return setError("PIN must be exactly 4 digits.");
          start(async () => {
            const r =
              mode === "new"
                ? await joinAsNew({ code, name, pin })
                : await reclaimMember({ code, memberId, pin });
            if (r && !r.ok) {
              setError(r.error);
              setPin("");
            }
          });
        }}
      >
        {mode === "new" ? (
          <div className="grid gap-2">
            <Label htmlFor="name">Pick a name</Label>
            <Input
              id="name"
              required
              maxLength={20}
              autoComplete="nickname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
            <p className="text-muted-foreground text-xs">1–20 characters, unique in this league.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="member">Who are you?</Label>
            <NativeSelect
              id="member"
              required
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            >
              <option value="" disabled>
                Choose your name…
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="pin">{mode === "new" ? "Set a 4-digit PIN" : "Your PIN"}</Label>
          <PinInput id="pin" required value={pin} onChange={(e) => setPin(e.target.value)} />
          {mode === "new" && (
            <p className="text-muted-foreground text-xs">
              You&apos;ll use it to sign in on other devices.
            </p>
          )}
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "One sec…" : mode === "new" ? "Join league" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
