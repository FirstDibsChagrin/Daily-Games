"use client";

import { Crown, KeyRound, RefreshCw, Trash2, UserMinus } from "lucide-react";
import Link from "@/components/app-link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteLeague,
  regenerateJoinCode,
  removeMember,
  renameLeague,
  resetMemberPin,
  transferOwnership,
  updatePointsTable,
} from "@/app/actions/admin";
import { FormError, PinInput } from "@/components/form-bits";
import { CopyButton } from "@/components/league/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ordinal } from "@/components/league/bits";

type M = { id: string; name: string; isCreator: boolean };

export function SettingsPanels({
  slug,
  origin,
  league,
  members,
  meId,
}: {
  slug: string;
  origin: string;
  league: { name: string; joinCode: string; pointsTable: number[] };
  members: M[];
  meId: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="grid gap-4">
        <RenameCard slug={slug} name={league.name} />
        <JoinCodeCard slug={slug} origin={origin} code={league.joinCode} />
        <PointsCard slug={slug} table={league.pointsTable} />
        <Card>
          <CardHeader>
            <CardTitle>Games</CardTitle>
            <CardDescription>
              Add, edit, reorder and archive games, and review suggestions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={`/l/${slug}/settings/games`}>Manage games</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4">
        <MembersCard slug={slug} members={members} meId={meId} />
        <DeleteCard slug={slug} name={league.name} />
      </div>
    </div>
  );
}

function RenameCard({ slug, name }: { slug: string; name: string }) {
  const [v, setV] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>League name</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await renameLeague({ slug, name: v });
              if (!r.ok) setError(r.error);
              else toast.success("League renamed");
            });
          }}
        >
          <Label htmlFor="league-name" className="sr-only">
            League name
          </Label>
          <Input id="league-name" maxLength={40} value={v} onChange={(e) => setV(e.target.value)} />
          <Button type="submit" disabled={pending || v.trim() === name}>
            Save
          </Button>
        </form>
        <FormError message={error} className="mt-2" />
      </CardContent>
    </Card>
  );
}

function JoinCodeCard({ slug, origin, code }: { slug: string; origin: string; code: string }) {
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Join code</CardTitle>
        <CardDescription>
          Regenerating makes the old code and link stop working. People already in the league stay
          signed in.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-36 rounded-md border px-3 py-2 font-mono text-2xl font-semibold tracking-[0.18em]">
            {shown ? code : "••••••"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setShown((s) => !s)}>
            {shown ? "Hide" : "Show"}
          </Button>
          <CopyButton text={code} label="Copy code" />
          <CopyButton text={`${origin}/join/${code}`} label="Copy link" />
        </div>
        <Button variant="outline" className="w-fit" onClick={() => setOpen(true)}>
          <RefreshCw /> Regenerate code
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Regenerate the join code?</DialogTitle>
              <DialogDescription>
                The current code ({code}) and its link will stop working immediately.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await regenerateJoinCode({ slug });
                    if (!r.ok) return void toast.error(r.error);
                    toast.success(`New code: ${r.code}`);
                    setShown(true);
                    setOpen(false);
                  })
                }
              >
                Regenerate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function PointsCard({ slug, table }: { slug: string; table: number[] }) {
  const [vals, setVals] = useState(table.map(String));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Points table</CardTitle>
        <CardDescription>
          Points per finishing place in each game. The last value also goes to every place below it
          and to anyone who taps X. All past standings recalculate instantly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const nums = vals.map((v) => Number(v));
            if (vals.some((v) => v.trim() === "" || !Number.isInteger(Number(v))))
              return setError("Whole numbers only.");
            start(async () => {
              const r = await updatePointsTable({ slug, table: nums });
              if (!r.ok) setError(r.error);
              else toast.success("Points table saved");
            });
          }}
        >
          <div className="flex flex-wrap items-end gap-2">
            {vals.map((v, i) => (
              <div key={i} className="grid gap-1">
                <Label htmlFor={`pt-${i}`} className="text-muted-foreground text-xs">
                  {i === vals.length - 1 ? `${ordinal(i + 1)}+` : ordinal(i + 1)}
                </Label>
                <Input
                  id={`pt-${i}`}
                  inputMode="numeric"
                  className="num w-16 text-center text-lg"
                  value={v}
                  onChange={(e) =>
                    setVals((s) =>
                      s.map((x, j) => (j === i ? e.target.value.replace(/\D/g, "") : x)),
                    )
                  }
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={vals.length >= 20}
              onClick={() => setVals((s) => [...s, s[s.length - 1] ?? "0"])}
            >
              + place
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={vals.length <= 1}
              onClick={() => setVals((s) => s.slice(0, -1))}
            >
              − place
            </Button>
          </div>
          <FormError message={error} />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              Save points
            </Button>
            <Button type="button" variant="ghost" onClick={() => setVals(["5", "3", "2", "1"])}>
              Reset to 5, 3, 2, 1
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function MembersCard({ slug, members, meId }: { slug: string; members: M[]; meId: string }) {
  const [dialog, setDialog] = useState<{ kind: "pin" | "remove" | "transfer"; m: M } | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const open = (kind: "pin" | "remove" | "transfer", m: M) => {
    setDialog({ kind, m });
    setPin("");
    setError(null);
  };
  const confirm = () =>
    start(async () => {
      if (!dialog) return;
      const { kind, m } = dialog;
      const r =
        kind === "pin"
          ? await resetMemberPin({ slug, memberId: m.id, pin })
          : kind === "remove"
            ? await removeMember({ slug, memberId: m.id })
            : await transferOwnership({ slug, memberId: m.id });
      if (!r.ok) return setError(r.error);
      toast.success(
        kind === "pin"
          ? `PIN reset for ${m.name}`
          : kind === "remove"
            ? `${m.name} removed`
            : `${m.name} is now the creator`,
      );
      setDialog(null);
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          Reset a forgotten PIN, hand over the league, or remove someone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-2 rounded-md border p-2"
              data-testid={`member-${m.name}`}
            >
              <span className="min-w-0 flex-1 font-medium">
                {m.name}
                {m.isCreator && (
                  <Crown className="text-gold ml-1 inline size-3.5" aria-label="creator" />
                )}
                {m.id === meId && <span className="text-accent ml-1 text-xs"> (you)</span>}
              </span>
              <Button size="sm" variant="ghost" onClick={() => open("pin", m)}>
                <KeyRound /> Reset PIN
              </Button>
              {m.id !== meId && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => open("transfer", m)}>
                    <Crown /> Make creator
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => open("remove", m)}
                  >
                    <UserMinus /> Remove
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
        <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialog?.kind === "pin" && `Reset ${dialog.m.name}'s PIN`}
                {dialog?.kind === "remove" && `Remove ${dialog.m.name}?`}
                {dialog?.kind === "transfer" && `Make ${dialog.m.name} the creator?`}
              </DialogTitle>
              <DialogDescription>
                {dialog?.kind === "pin" &&
                  "Choose a new 4-digit PIN and tell them. Their other devices will be signed out."}
                {dialog?.kind === "remove" &&
                  "This deletes all of their scores and badges. Standings will recalculate."}
                {dialog?.kind === "transfer" &&
                  "They'll get all creator powers and you'll become a regular member."}
              </DialogDescription>
            </DialogHeader>
            {dialog?.kind === "pin" && (
              <div className="grid gap-2">
                <Label htmlFor="reset-pin">New PIN</Label>
                <PinInput id="reset-pin" value={pin} onChange={(e) => setPin(e.target.value)} />
              </div>
            )}
            <FormError message={error} />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button
                variant={dialog?.kind === "remove" ? "destructive" : "default"}
                disabled={pending}
                onClick={confirm}
              >
                {dialog?.kind === "pin"
                  ? "Set PIN"
                  : dialog?.kind === "remove"
                    ? "Remove"
                    : "Transfer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function DeleteCard({ slug, name }: { slug: string; name: string }) {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Delete league</CardTitle>
        <CardDescription>
          Deletes every member, game, score and badge. This can&apos;t be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await deleteLeague({ slug, confirmName: confirmText });
              if (r && !r.ok) setError(r.error);
            });
          }}
        >
          <Label htmlFor="delete-confirm">
            Type <strong>{name}</strong> to confirm
          </Label>
          <Input
            id="delete-confirm"
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
          <FormError message={error} />
          <Button
            type="submit"
            variant="destructive"
            className="w-fit"
            disabled={pending || confirmText.trim() !== name.trim()}
          >
            <Trash2 /> Delete league forever
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
