"use client";

import { LogOut } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { suggestGame } from "@/app/actions/games";
import { changeMyPin, signOut } from "@/app/actions/identity";
import { FormError, PinInput } from "@/components/form-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SuggestForm({ slug }: { slug: string }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await suggestGame({ slug, name, url, description });
          if (!r.ok) return setError(r.error);
          toast.success("Suggestion sent to the creator");
          setName("");
          setUrl("");
          setDescription("");
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="sg-name">Game name</Label>
        <Input
          id="sg-name"
          required
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sg-url">Link (optional)</Label>
        <Input
          id="sg-url"
          type="url"
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sg-desc">How does scoring work?</Label>
        <Textarea
          id="sg-desc"
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. You get a score out of 1000 at the end; higher is better."
        />
      </div>
      <FormError message={error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send suggestion"}
      </Button>
    </form>
  );
}

export function AccountCard({ slug, name }: { slug: string; name: string }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>You: {name}</CardTitle>
        <CardDescription>Your PIN lets you sign in as {name} on other devices.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await changeMyPin({ slug, currentPin: cur, newPin: next });
              if (!r.ok) return setError(r.error);
              toast.success("PIN changed");
              setCur("");
              setNext("");
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="cur-pin">Current PIN</Label>
            <PinInput id="cur-pin" required value={cur} onChange={(e) => setCur(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-pin">New PIN</Label>
            <PinInput
              id="new-pin"
              required
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            Change PIN
          </Button>
        </form>
        <FormError message={error} />
        <div className="border-t pt-4">
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              if (
                confirm(
                  "Sign out of this league on this device? You can sign back in with your PIN.",
                )
              ) {
                start(async () => {
                  const r = await signOut({ slug });
                  if (r && !r.ok) toast.error(r.error);
                });
              }
            }}
          >
            <LogOut /> Sign out on this device
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
