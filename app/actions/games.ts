"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { CATALOG } from "@/lib/catalog-data";
import {
  run,
  requireActor,
  requireCreator,
  UserError,
  type ActionResult,
} from "@/lib/server/action";
import { syncBadges } from "@/lib/server/badges";
import { today } from "@/lib/server/clock";
import { db } from "@/lib/server/db";
import { firstError, gameFieldsSchema, suggestionSchema, type GameFields } from "@/lib/validation";

function done(slug: string) {
  revalidatePath(`/l/${slug}`, "layout");
}

function resync(leagueId: string) {
  after(async () => {
    try {
      await syncBadges(leagueId, await today());
    } catch (e) {
      console.error("badge sync", e);
    }
  });
}

async function nextSortOrder(leagueId: string): Promise<number> {
  const [{ n }] = await db()<{ n: number }[]>`
    select coalesce(max(sort_order), -1)::int + 1 as n from league_games where league_id = ${leagueId}`;
  return n;
}

async function ownGame(leagueId: string, gameId: unknown) {
  const id = z.uuid().safeParse(gameId);
  if (!id.success) throw new UserError("Unknown game.");
  const [g] = await db()<{ id: string; name: string; archived_at: Date | null }[]>`
    select id, name, archived_at from league_games where id = ${id.data} and league_id = ${leagueId}`;
  if (!g) throw new UserError("That game isn't in this league.");
  return g;
}

function parseFields(fields: unknown): GameFields {
  const r = gameFieldsSchema.safeParse(fields);
  if (!r.success) throw new UserError(firstError(r.error));
  return r.data;
}

/** Copies catalog games into the league (restoring archived copies instead of duplicating). */
export async function addCatalogGames(input: {
  slug: string;
  keys: string[];
}): Promise<ActionResult<{ added: number }>> {
  return run(async () => {
    const me = await requireCreator(input.slug);
    const keys = z.array(z.string().max(60)).max(100).parse(input.keys);
    const sql = db();
    let added = 0;
    let order = await nextSortOrder(me.leagueId);
    for (const key of keys) {
      const g = CATALOG.find((c) => c.key === key);
      const [dbRow] = await sql<
        { key: string }[]
      >`select key from catalog_games where key = ${key}`;
      if (!g || !dbRow) continue;
      const existing = await sql<{ id: string; archived_at: Date | null }[]>`
        select id, archived_at from league_games where league_id = ${me.leagueId} and catalog_key = ${key}
        order by archived_at nulls first limit 1`;
      if (existing[0]) {
        if (existing[0].archived_at) {
          await sql`update league_games set archived_at = null, sort_order = ${order++} where id = ${existing[0].id}`;
          added++;
        }
        continue;
      }
      await sql`
        insert into league_games (league_id, catalog_key, name, entry_prompt, entry_example, input_type,
          min, max, direction, allow_fail, color, sort_order, url, unit_label)
        values (${me.leagueId}, ${g.key}, ${g.name}, ${g.entry_prompt}, ${g.entry_example}, ${g.input_type},
          ${g.min}, ${g.max}, ${g.direction}, ${g.allow_fail}, ${g.color}, ${order++}, ${g.url}, ${g.unit_label})`;
      added++;
    }
    resync(me.leagueId);
    done(input.slug);
    return { ok: true, added };
  });
}

export async function createGame(input: {
  slug: string;
  fields: unknown;
  suggestionId?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const me = await requireCreator(input.slug);
    const f = parseFields(input.fields);
    const sql = db();
    const [row] = await sql<{ id: string }[]>`
      insert into league_games (league_id, name, entry_prompt, entry_example, input_type, min, max,
        direction, allow_fail, color, sort_order, url, unit_label)
      values (${me.leagueId}, ${f.name}, ${f.entry_prompt}, ${f.entry_example}, ${f.input_type}, ${f.min},
        ${f.max}, ${f.direction}, ${f.allow_fail}, ${f.color}, ${await nextSortOrder(me.leagueId)},
        ${f.url}, ${f.unit_label})
      returning id`;
    if (input.suggestionId && z.uuid().safeParse(input.suggestionId).success) {
      await sql`update game_suggestions set status = 'approved'
        where id = ${input.suggestionId} and league_id = ${me.leagueId}`;
    }
    resync(me.leagueId);
    done(input.slug);
    return { ok: true, id: row.id };
  });
}

export async function updateGame(input: {
  slug: string;
  gameId: string;
  fields: unknown;
}): Promise<ActionResult> {
  return run(async () => {
    const me = await requireCreator(input.slug);
    const g = await ownGame(me.leagueId, input.gameId);
    const f = parseFields(input.fields);
    await db()`
      update league_games set name = ${f.name}, entry_prompt = ${f.entry_prompt},
        entry_example = ${f.entry_example}, input_type = ${f.input_type}, min = ${f.min}, max = ${f.max},
        direction = ${f.direction}, allow_fail = ${f.allow_fail}, color = ${f.color}, url = ${f.url},
        unit_label = ${f.unit_label}
      where id = ${g.id}`;
    resync(me.leagueId);
    done(input.slug);
    return { ok: true };
  });
}

export async function reorderGames(input: { slug: string; ids: string[] }): Promise<ActionResult> {
  return run(async () => {
    const me = await requireCreator(input.slug);
    const ids = z.array(z.uuid()).max(200).parse(input.ids);
    const sql = db();
    await sql.begin(async (tx) => {
      for (const [i, id] of ids.entries()) {
        await tx`update league_games set sort_order = ${i} where id = ${id} and league_id = ${me.leagueId}`;
      }
    });
    done(input.slug);
    return { ok: true };
  });
}

export async function setGameArchived(input: {
  slug: string;
  gameId: string;
  archived: boolean;
}): Promise<ActionResult> {
  return run(async () => {
    const me = await requireCreator(input.slug);
    const g = await ownGame(me.leagueId, input.gameId);
    if (input.archived) {
      await db()`update league_games set archived_at = now() where id = ${g.id}`;
    } else {
      await db()`update league_games set archived_at = null, sort_order = ${await nextSortOrder(me.leagueId)}
        where id = ${g.id}`;
    }
    resync(me.leagueId);
    done(input.slug);
    return { ok: true };
  });
}

/** Permanently deletes a game and all of its scores. Requires typing the game's name. */
export async function deleteGamePermanently(input: {
  slug: string;
  gameId: string;
  confirmName: string;
}): Promise<ActionResult> {
  return run(async () => {
    const me = await requireCreator(input.slug);
    const g = await ownGame(me.leagueId, input.gameId);
    if (input.confirmName.trim().toLowerCase() !== g.name.toLowerCase()) {
      throw new UserError(`Type “${g.name}” exactly to confirm.`);
    }
    await db()`delete from league_games where id = ${g.id}`; // scores cascade
    resync(me.leagueId);
    done(input.slug);
    return { ok: true };
  });
}

export async function suggestGame(input: {
  slug: string;
  name: string;
  url: string;
  description: string;
}): Promise<ActionResult> {
  return run(async () => {
    const me = await requireActor(input.slug);
    const r = suggestionSchema.safeParse(input);
    if (!r.success) throw new UserError(firstError(r.error));
    const [{ n }] = await db()<{ n: number }[]>`
      select count(*)::int as n from game_suggestions where league_id = ${me.leagueId} and status = 'pending'`;
    if (n >= 50)
      throw new UserError("The suggestions inbox is full. Ask the creator to review it.");
    await db()`
      insert into game_suggestions (league_id, member_id, name, url, description)
      values (${me.leagueId}, ${me.memberId}, ${r.data.name}, ${r.data.url}, ${r.data.description})`;
    done(input.slug);
    return { ok: true };
  });
}

/** Approve via a catalog match (adds it) or dismiss. Approving a custom game goes through createGame. */
export async function resolveSuggestion(input: {
  slug: string;
  suggestionId: string;
  action: "dismiss" | "approve";
  catalogKey?: string | null;
}): Promise<ActionResult> {
  return run(async () => {
    const me = await requireCreator(input.slug);
    const id = z.uuid().parse(input.suggestionId);
    if (input.action === "approve" && input.catalogKey) {
      const res = await addCatalogGames({ slug: input.slug, keys: [input.catalogKey] });
      if (!res.ok) return res;
    }
    await db()`
      update game_suggestions set status = ${input.action === "approve" ? "approved" : "dismissed"}
      where id = ${id} and league_id = ${me.leagueId}`;
    done(input.slug);
    return { ok: true };
  });
}
