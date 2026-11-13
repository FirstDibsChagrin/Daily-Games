"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import {
  run,
  requireCreator,
  isUniqueViolation,
  UserError,
  type ActionResult,
} from "@/lib/server/action";
import { syncBadges } from "@/lib/server/badges";
import { today } from "@/lib/server/clock";
import { generateCode } from "@/lib/server/codes";
import { db } from "@/lib/server/db";
import { hashPin, signOutOf } from "@/lib/server/session";
import { firstError, leagueNameSchema, pinSchema, pointsTableSchema } from "@/lib/validation";

function done(slug: string) {
  revalidatePath(`/l/${slug}`, "layout");
  revalidatePath("/");
}

async function otherMember(leagueId: string, memberId: unknown) {
  const id = z.uuid().safeParse(memberId);
  if (!id.success) throw new UserError("Unknown member.");
  const [m] = await db()<{ id: string; name: string; is_creator: boolean }[]>`
    select id, name, is_creator from members where id = ${id.data} and league_id = ${leagueId}`;
  if (!m) throw new UserError("That member isn't in this league.");
  return m;
}

export async function renameLeague(input: { slug: string; name: string }): Promise<ActionResult> {
  return run(async () => {
    const me = await requireCreator(input.slug);
    const r = leagueNameSchema.safeParse(input.name);
    if (!r.success) throw new UserError(firstError(r.error));
    await db()`update leagues set name = ${r.data} where id = ${me.leagueId}`;
    done(input.slug);
    return { ok: true };
  });
}

/** New join code. The old code stops working; league URLs and existing devices are unaffected. */
export async function regenerateJoinCode(input: {
  slug: string;
}): Promise<ActionResult<{ code: string }>> {
  return run(async () => {
    const me = await requireCreator(input.slug);
    for (let i = 0; i < 8; i++) {
      const code = generateCode();
      try {
        // Avoid reusing another league's permanent slug as a join code.
        const [clash] =
          await db()`select 1 from leagues where slug = ${code} and id <> ${me.leagueId}`;
        if (clash) continue;
        await db()`update leagues set join_code = ${code} where id = ${me.leagueId}`;
        done(input.slug);
        return { ok: true, code };
      } catch (e) {
        if (isUniqueViolation(e)) continue;
        throw e;
      }
    }
    throw new UserError("Couldn't generate a new code. Try again.");
  });
}

export async function updatePointsTable(input: {
  slug: string;
  table: number[];
}): Promise<ActionResult> {
  return run(async () => {
    const me = await requireCreator(input.slug);
    const r = pointsTableSchema.safeParse(input.table);
    if (!r.success) throw new UserError(firstError(r.error));
    await db()`update leagues set points_table = ${r.data} where id = ${me.leagueId}`;
    after(async () => syncBadges(me.leagueId, await today()).catch(console.error));
    done(input.slug);
    return { ok: true };
  });
}

export async function removeMember(input: {
  slug: string;
  memberId: string;
}): Promise<ActionResult> {
  return run(async () => {
    const me = await requireCreator(input.slug);
    const m = await otherMember(me.leagueId, input.memberId);
    if (m.id === me.memberId)
      throw new UserError("You can't remove yourself. Transfer ownership first.");
    await db()`delete from members where id = ${m.id}`; // scores, sessions and badges cascade
    after(async () => syncBadges(me.leagueId, await today()).catch(console.error));
    done(input.slug);
    return { ok: true };
  });
}

/** Sets a new PIN for a member who forgot theirs and signs out their other devices. */
export async function resetMemberPin(input: {
  slug: string;
  memberId: string;
  pin: string;
}): Promise<ActionResult> {
  return run(async () => {
    const me = await requireCreator(input.slug);
    const m = await otherMember(me.leagueId, input.memberId);
    const pin = pinSchema.safeParse(input.pin);
    if (!pin.success) throw new UserError(firstError(pin.error));
    const sql = db();
    await sql`update members set pin_hash = ${await hashPin(pin.data)} where id = ${m.id}`;
    if (m.id !== me.memberId) await sql`delete from member_sessions where member_id = ${m.id}`;
    // Clear any lockouts on this name.
    const lname = m.name.toLowerCase();
    const esc = lname.replace(/[\\%_]/g, "\\$&");
    await sql`delete from rate_limits
      where key = ${`pinname:${me.leagueId}:${lname}`} or key like ${`pin:${me.leagueId}:${esc}:%`}`;
    return { ok: true };
  });
}

export async function transferOwnership(input: {
  slug: string;
  memberId: string;
}): Promise<ActionResult> {
  return run(async () => {
    const me = await requireCreator(input.slug);
    const m = await otherMember(me.leagueId, input.memberId);
    if (m.id === me.memberId) throw new UserError("You're already the creator.");
    await db().begin(async (tx) => {
      await tx`update members set is_creator = false where league_id = ${me.leagueId}`;
      await tx`update members set is_creator = true where id = ${m.id}`;
    });
    done(input.slug);
    return { ok: true };
  });
}

export async function deleteLeague(input: {
  slug: string;
  confirmName: string;
}): Promise<ActionResult> {
  const res = await run(async () => {
    const me = await requireCreator(input.slug);
    if (input.confirmName.trim() !== me.leagueName.trim()) {
      throw new UserError(`Type “${me.leagueName}” exactly to confirm.`);
    }
    await signOutOf(me.leagueId);
    await db()`delete from leagues where id = ${me.leagueId}`;
    return { ok: true };
  });
  if (res.ok) redirect("/");
  return res;
}
