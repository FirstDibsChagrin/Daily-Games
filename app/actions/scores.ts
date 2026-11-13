"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { isPlainDate } from "@/lib/dates";
import { parseScoreInput } from "@/lib/score-values";
import { rankGameDay } from "@/lib/scoring";
import { run, requireActor, UserError, type ActionResult } from "@/lib/server/action";
import { syncBadges } from "@/lib/server/badges";
import { today as getToday } from "@/lib/server/clock";
import { db } from "@/lib/server/db";
import { getGames, getLeague } from "@/lib/server/league";

const entrySchema = z.object({
  gameId: z.uuid(),
  raw: z.string().max(20).optional(),
  failed: z.boolean(),
});
const saveSchema = z.object({
  slug: z.string().max(10),
  date: z.string().refine(isPlainDate, "Invalid date."),
  entries: z.array(entrySchema).min(1).max(50),
});

export interface SaveOutcome {
  gameId: string;
  ok: boolean;
  error?: string;
}

async function checkDate(date: string) {
  const today = await getToday();
  if (date > today) throw new UserError("You can't enter scores for future days.");
  if (date < "2000-01-01") throw new UserError("That date is too far back.");
  return today;
}

/** Saves one or more of my scores for a day. Each entry is validated on its own. */
export async function saveScores(
  input: z.input<typeof saveSchema>,
): Promise<ActionResult<{ results: SaveOutcome[]; tookFirst: string[] }>> {
  return run(async () => {
    const parsed = saveSchema.safeParse(input);
    if (!parsed.success) throw new UserError("Invalid request.");
    const { slug, date, entries } = parsed.data;
    const me = await requireActor(slug);
    const today = await checkDate(date);
    const games = new Map((await getGames(me.leagueId)).map((g) => [g.id, g]));
    const sql = db();
    const results: SaveOutcome[] = [];
    const saved: string[] = [];
    for (const e of entries) {
      const game = games.get(e.gameId);
      if (!game || game.archived_at) {
        results.push({
          gameId: e.gameId,
          ok: false,
          error: "That game isn't active in this league.",
        });
        continue;
      }
      let value: number | null = null;
      if (e.failed) {
        if (!game.allow_fail) {
          results.push({ gameId: e.gameId, ok: false, error: `${game.name} doesn't allow an X.` });
          continue;
        }
      } else {
        const p = parseScoreInput(game, e.raw ?? "");
        if (!p.ok) {
          results.push({ gameId: e.gameId, ok: false, error: p.error });
          continue;
        }
        value = p.value;
      }
      await sql`
        insert into scores (league_id, member_id, game_id, play_date, value, failed)
        values (${me.leagueId}, ${me.memberId}, ${game.id}, ${date}, ${value}, ${e.failed})
        on conflict (member_id, game_id, play_date)
        do update set value = excluded.value, failed = excluded.failed, updated_at = now()`;
      results.push({ gameId: e.gameId, ok: true });
      saved.push(game.id);
    }

    // Did I just take (or keep) first place in any game I saved?
    const tookFirst: string[] = [];
    if (saved.length) {
      const league = await getLeague(me.leagueId);
      const rows = await sql<
        { member_id: string; game_id: string; value: number | null; failed: boolean }[]
      >`
        select member_id, game_id, value, failed from scores
        where league_id = ${me.leagueId} and play_date = ${date} and game_id in ${sql(saved)}`;
      for (const gameId of saved) {
        const r = rankGameDay(
          rows
            .filter((x) => x.game_id === gameId)
            .map((x) => ({ memberId: x.member_id, value: x.value, failed: x.failed })),
          games.get(gameId)!.direction,
          league!.points_table,
        );
        if (r.winners.includes(me.memberId)) tookFirst.push(gameId);
      }
      after(() => syncBadges(me.leagueId, today).catch((err) => console.error("badge sync", err)));
      revalidatePath(`/l/${slug}`, "layout");
    }
    return { ok: true, results, tookFirst };
  });
}

export async function deleteScore(input: {
  slug: string;
  gameId: string;
  date: string;
}): Promise<ActionResult> {
  return run(async () => {
    const me = await requireActor(input.slug);
    if (!isPlainDate(input.date)) throw new UserError("Invalid date.");
    const today = await getToday();
    const gameId = z.uuid().parse(input.gameId);
    // Ownership: only rows belonging to my member id can match.
    await db()`
      delete from scores where member_id = ${me.memberId} and game_id = ${gameId} and play_date = ${input.date}`;
    after(() => syncBadges(me.leagueId, today).catch((err) => console.error("badge sync", err)));
    revalidatePath(`/l/${input.slug}`, "layout");
    return { ok: true };
  });
}
