"use client";

import { useState, useTransition } from "react";
import { createLeague } from "@/app/actions/identity";
import { FormError, PinInput } from "@/components/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateLeagueForm() {
  const [leagueName, setLeagueName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!/^\d{4}$/.test(pin)) return setError("PIN must be exactly 4 digits.");
        start(async () => {
          const r = await createLeague({ leagueName, playerName, pin });
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="leagueName">League name</Label>
        <Input
          id="leagueName"
          required
          maxLength={40}
          value={leagueName}
          onChange={(e) => setLeagueName(e.target.value)}
          placeholder="The Puzzle Pals"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="playerName">Your name</Label>
        <Input
          id="playerName"
          required
          maxLength={20}
          autoComplete="nickname"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Jack"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pin">Choose a 4-digit PIN</Label>
        <PinInput id="pin" required value={pin} onChange={(e) => setPin(e.target.value)} />
        <p className="text-muted-foreground text-xs">
          You&apos;ll use it to sign in on another device.
        </p>
      </div>
      <FormError message={error} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating…" : "Create league"}
      </Button>
    </form>
  );
}
