"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronDown,
  GripVertical,
  Inbox,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addCatalogGames,
  createGame,
  deleteGamePermanently,
  reorderGames,
  resolveSuggestion,
  setGameArchived,
  updateGame,
} from "@/app/actions/games";
import { FormError } from "@/components/form-bits";
import { GameDot } from "@/components/league/bits";
import { BLANK_GAME, GameForm, type GameFormValues } from "@/components/league/game-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CatalogGame } from "@/lib/catalog-data";
import { cn } from "@/lib/utils";

interface Game extends GameFormValues {
  id: string;
  catalog_key: string | null;
  sort_order: number;
  archived: boolean;
}

interface Suggestion {
  id: string;
  name: string;
  url: string | null;
  description: string;
  created_at: string;
  member_name: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function GamesManager({
  slug,
  games,
  catalog,
  scoreCounts,
  suggestions,
}: {
  slug: string;
  games: Game[];
  catalog: CatalogGame[];
  scoreCounts: Record<string, number>;
  suggestions: Suggestion[];
}) {
  const router = useRouter();
  const active = games.filter((g) => !g.archived);
  const archived = games.filter((g) => g.archived);
  const [prefill, setPrefill] = useState<{ values: GameFormValues; suggestionId: string } | null>(
    null,
  );
  const customRef = useRef<HTMLDivElement>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
      <div className="grid min-w-0 gap-6">
        {suggestions.length > 0 && (
          <SuggestionsInbox
            slug={slug}
            suggestions={suggestions}
            catalog={catalog}
            activeKeys={new Set(active.map((g) => g.catalog_key).filter(Boolean) as string[])}
            onCustom={(s) => {
              setPrefill({
                suggestionId: s.id,
                values: { ...BLANK_GAME, name: s.name, url: s.url, entry_prompt: s.description },
              });
              setTimeout(
                () => customRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                50,
              );
            }}
          />
        )}
        <ActiveGames
          slug={slug}
          games={active}
          scoreCounts={scoreCounts}
          onChanged={() => router.refresh()}
        />
        {archived.length > 0 && (
          <ArchivedGames slug={slug} games={archived} scoreCounts={scoreCounts} />
        )}
      </div>
      <div className="grid min-w-0 gap-6">
        <CatalogPicker slug={slug} catalog={catalog} games={games} />
        <div ref={customRef} className="scroll-mt-20">
          <CustomGame slug={slug} prefill={prefill} onDone={() => setPrefill(null)} />
        </div>
      </div>
    </div>
  );
}

function SuggestionsInbox({
  slug,
  suggestions,
  catalog,
  activeKeys,
  onCustom,
}: {
  slug: string;
  suggestions: Suggestion[];
  catalog: CatalogGame[];
  activeKeys: Set<string>;
  onCustom: (s: Suggestion) => void;
}) {
  const [pending, start] = useTransition();
  const act = (s: Suggestion, action: "dismiss" | "approve", catalogKey?: string) =>
    start(async () => {
      const r = await resolveSuggestion({ slug, suggestionId: s.id, action, catalogKey });
      if (!r.ok) toast.error(r.error);
      else toast.success(action === "dismiss" ? "Suggestion dismissed" : `Added ${s.name}`);
    });
  return (
    <Card className="border-ring/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="text-accent size-5" aria-hidden /> Suggestions
          <Badge>{suggestions.length}</Badge>
        </CardTitle>
        <CardDescription>Games your members want to add.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3">
          {suggestions.map((s) => {
            const match = catalog.find(
              (c) => norm(c.name) === norm(s.name) || norm(c.key) === norm(s.name),
            );
            return (
              <li key={s.id} className="rounded-md border p-3" data-testid="suggestion">
                <p className="font-semibold">{s.name}</p>
                <p className="text-muted-foreground text-xs">
                  Suggested by {s.member_name ?? "a former member"}
                </p>
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent block truncate text-sm underline"
                  >
                    {s.url}
                  </a>
                )}
                {s.description && (
                  <p className="mt-1 text-sm whitespace-pre-wrap">{s.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {match && !activeKeys.has(match.key) ? (
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => act(s, "approve", match.key)}
                    >
                      <Check /> Add {match.name} from catalog
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant={match ? "outline" : "default"}
                    onClick={() => onCustom(s)}
                  >
                    <Plus /> Approve & set up
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => act(s, "dismiss")}
                  >
                    <X /> Dismiss
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function ActiveGames({
  slug,
  games,
  scoreCounts,
  onChanged,
}: {
  slug: string;
  games: Game[];
  scoreCounts: Record<string, number>;
  onChanged: () => void;
}) {
  const [order, setOrder] = useState(games.map((g) => g.id));
  const [editing, setEditing] = useState<string | null>(null);
  const [, start] = useTransition();
  const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  // Keep local order in sync when games are added/removed.
  const key = games.map((g) => g.id).join(",");
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setOrder(games.map((g) => g.id));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const next = arrayMove(
      order,
      order.indexOf(String(e.active.id)),
      order.indexOf(String(e.over.id)),
    );
    setOrder(next);
    start(async () => {
      const r = await reorderGames({ slug, ids: next });
      if (!r.ok) toast.error(r.error);
      else onChanged();
    });
  }

  function move(id: string, dir: -1 | 1) {
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = arrayMove(order, i, j);
    setOrder(next);
    start(async () => {
      const r = await reorderGames({ slug, ids: next });
      if (!r.ok) toast.error(r.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your games ({games.length})</CardTitle>
        <CardDescription>
          Drag to reorder (or use the arrow keys on the handle). This is the order on the Today
          screen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {games.length === 0 ? (
          <p className="text-muted-foreground rounded-md border p-6 text-center text-sm">
            No games yet. Tick some from the catalog to get started.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              <ul className="grid gap-2" data-testid="active-games">
                {order
                  .filter((id) => byId.has(id))
                  .map((id, i) => (
                    <SortableGameRow
                      key={id}
                      slug={slug}
                      game={byId.get(id)!}
                      index={i}
                      total={order.length}
                      count={scoreCounts[id] ?? 0}
                      editing={editing === id}
                      onEdit={() => setEditing(editing === id ? null : id)}
                      onMove={(d) => move(id, d)}
                    />
                  ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}

function SortableGameRow({
  slug,
  game: g,
  index,
  total,
  count,
  editing,
  onEdit,
  onMove,
}: {
  slug: string;
  game: Game;
  index: number;
  total: number;
  count: number;
  editing: boolean;
  onEdit: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: g.id,
  });
  const [pending, start] = useTransition();
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "bg-card min-w-0 rounded-md border",
        isDragging && "ring-ring relative z-10 shadow-xl ring-2",
      )}
      data-testid={`game-row-${g.name}`}
    >
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          className="text-muted-foreground hover:bg-muted cursor-grab touch-none rounded p-1.5 active:cursor-grabbing"
          aria-label={`Reorder ${g.name}. Position ${index + 1} of ${total}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <GameDot color={g.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{g.name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {g.direction === "lower_is_better" ? "Lower wins" : "Higher wins"} ·{" "}
            {g.input_type === "time" ? "time" : `${g.min}–${g.max}`}
            {g.allow_fail ? " · X allowed" : ""} · {count} {count === 1 ? "score" : "scores"}
          </p>
        </div>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden sm:inline-flex"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label={`Move ${g.name} up`}
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden sm:inline-flex"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label={`Move ${g.name} down`}
          >
            ↓
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            aria-expanded={editing}
            aria-label={`Edit ${g.name}`}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={`Archive ${g.name}`}
            title="Archive (hide, keep scores)"
            onClick={() =>
              start(async () => {
                const r = await setGameArchived({ slug, gameId: g.id, archived: true });
                if (!r.ok) toast.error(r.error);
                else
                  toast(`${g.name} archived`, {
                    description: "Hidden from entry and boards. Scores are kept.",
                    action: {
                      label: "Undo",
                      onClick: () => void setGameArchived({ slug, gameId: g.id, archived: false }),
                    },
                  });
              })
            }
          >
            <Archive />
          </Button>
        </div>
      </div>
      {editing && (
        <div className="border-t p-3">
          <GameForm
            idPrefix={`edit-${g.id}`}
            initial={g}
            hasScores={count > 0}
            submitLabel="Save changes"
            onCancel={onEdit}
            onSubmit={async (fields) => {
              const r = await updateGame({ slug, gameId: g.id, fields });
              if (!r.ok) return r.error;
              toast.success(`${fields.name} updated`);
              onEdit();
              return null;
            }}
          />
        </div>
      )}
    </li>
  );
}

function CatalogPicker({
  slug,
  catalog,
  games,
}: {
  slug: string;
  catalog: CatalogGame[];
  games: Game[];
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const activeByKey = new Map(
    games.filter((g) => !g.archived && g.catalog_key).map((g) => [g.catalog_key!, g]),
  );
  const filtered = catalog.filter(
    (c) => norm(c.name).includes(norm(q)) || norm(c.key).includes(norm(q)),
  );

  const toggle = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add from catalog</CardTitle>
        <CardDescription>
          Tick games, then add them all at once. You can edit any game after adding it.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search games"
            aria-label="Search the catalog"
            className="pl-9"
          />
        </div>
        <ul className="grid max-h-[28rem] gap-1 overflow-y-auto pr-1" data-testid="catalog-list">
          {filtered.map((c) => {
            const inLeague = activeByKey.get(c.key);
            const id = `cat-${c.key}`;
            return (
              <li
                key={c.key}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-2",
                  !inLeague && "hover:bg-muted/60",
                )}
              >
                {inLeague ? (
                  <Check className="text-success size-5" aria-label="Already in league" />
                ) : (
                  <Checkbox
                    id={id}
                    checked={selected.has(c.key)}
                    onCheckedChange={() => toggle(c.key)}
                  />
                )}
                <label
                  htmlFor={inLeague ? undefined : id}
                  className={cn("min-w-0 flex-1", !inLeague && "cursor-pointer")}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <GameDot color={c.color} />
                    {c.name}
                    {!c.verified && (
                      <Badge variant="warning" title={c.note ?? "Scoring not confirmed"}>
                        unverified
                      </Badge>
                    )}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {c.entry_prompt}
                  </span>
                </label>
                {inLeague && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await setGameArchived({
                          slug,
                          gameId: inLeague.id,
                          archived: true,
                        });
                        if (!r.ok) toast.error(r.error);
                        else toast(`${c.name} archived (scores kept)`);
                      })
                    }
                  >
                    Remove
                  </Button>
                )}
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="text-muted-foreground p-4 text-center text-sm">
              No catalog games match “{q}”.
            </li>
          )}
        </ul>
        <Button
          disabled={selected.size === 0 || pending}
          onClick={() =>
            start(async () => {
              const r = await addCatalogGames({ slug, keys: [...selected] });
              if (!r.ok) return void toast.error(r.error);
              toast.success(`Added ${r.added} ${r.added === 1 ? "game" : "games"}`);
              setSelected(new Set());
            })
          }
        >
          <Plus /> Add selected{selected.size ? ` (${selected.size})` : ""}
        </Button>
      </CardContent>
    </Card>
  );
}

function CustomGame({
  slug,
  prefill,
  onDone,
}: {
  slug: string;
  prefill: { values: GameFormValues; suggestionId: string } | null;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isOpen = open || !!prefill;
  return (
    <Card>
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            setOpen(false);
            onDone();
          } else setOpen(true);
        }}
        aria-expanded={isOpen}
        className="flex w-full cursor-pointer items-center justify-between p-4 text-left sm:p-5"
      >
        <span>
          <span className="font-display block text-lg font-semibold">
            {prefill ? `Set up “${prefill.values.name}”` : "Create custom game"}
          </span>
          <span className="text-muted-foreground text-sm">For games not in the catalog.</span>
        </span>
        <ChevronDown
          className={cn("size-5 transition-transform", isOpen && "rotate-180")}
          aria-hidden
        />
      </button>
      {isOpen && (
        <CardContent>
          <GameForm
            key={prefill?.suggestionId ?? "new"}
            idPrefix="new-game"
            initial={prefill?.values ?? BLANK_GAME}
            submitLabel={prefill ? "Approve & add game" : "Create game"}
            onCancel={() => {
              setOpen(false);
              onDone();
            }}
            onSubmit={async (fields) => {
              const r = await createGame({ slug, fields, suggestionId: prefill?.suggestionId });
              if (!r.ok) return r.error;
              toast.success(`${fields.name} added`);
              setOpen(false);
              onDone();
              return null;
            }}
          />
        </CardContent>
      )}
    </Card>
  );
}

function ArchivedGames({
  slug,
  games,
  scoreCounts,
}: {
  slug: string;
  games: Game[];
  scoreCounts: Record<string, number>;
}) {
  const [pending, start] = useTransition();
  const [deleting, setDeleting] = useState<Game | null>(null);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Archived</CardTitle>
        <CardDescription>
          Hidden from entry and boards. Scores are kept, so restoring brings everything back.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2" data-testid="archived-games">
          {games.map((g) => (
            <li key={g.id} className="flex items-center gap-2 rounded-md border p-2">
              <GameDot color={g.color} />
              <span className="text-muted-foreground min-w-0 flex-1 truncate font-medium">
                {g.name} <span className="text-xs">· {scoreCounts[g.id] ?? 0} scores</span>
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await setGameArchived({ slug, gameId: g.id, archived: false });
                    if (!r.ok) toast.error(r.error);
                    else toast.success(`${g.name} restored`);
                  })
                }
              >
                <ArchiveRestore /> Restore
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Delete ${g.name} permanently`}
                onClick={() => {
                  setDeleting(g);
                  setConfirm("");
                  setError(null);
                }}
              >
                <Trash2 className="text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
        <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {deleting?.name} permanently?</DialogTitle>
              <DialogDescription>
                This deletes the game and all {deleting ? (scoreCounts[deleting.id] ?? 0) : 0} of
                its scores. Points and standings will be recalculated. This can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!deleting) return;
                start(async () => {
                  const r = await deleteGamePermanently({
                    slug,
                    gameId: deleting.id,
                    confirmName: confirm,
                  });
                  if (!r.ok) return setError(r.error);
                  toast.success(`${deleting.name} deleted`);
                  setDeleting(null);
                });
              }}
            >
              <label className="text-sm" htmlFor="confirm-delete-game">
                Type <strong>{deleting?.name}</strong> to confirm
              </label>
              <Input
                id="confirm-delete-game"
                autoComplete="off"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <FormError message={error} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setDeleting(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={
                    pending || confirm.trim().toLowerCase() !== deleting?.name.toLowerCase()
                  }
                >
                  Delete forever
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
