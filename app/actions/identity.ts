"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  run,
  requireActor,
  isUniqueViolation,
  UserError,
  type ActionResult,
} from "@/lib/server/action";
import { generateCode } from "@/lib/server/codes";
import { db } from "@/lib/server/db";
import { clear, hit, lockedFor, lockMessage, RULES } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";
import { hashPin, signInAs, signOutOf, verifyPin } from "@/lib/server/session";
import {
  codeSchema,
  firstError,
  leagueNameSchema,
  memberNameSchema,
  pinSchema,
  uuidSchema,
} from "@/lib/validation";

function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw new UserError(firstError(r.error));
  return r.data;
}

export async function createLeague(input: {
  leagueName: string;
  playerName: string;
  pin: string;
}): Promise<ActionResult> {
  let slug = "";
  const res = await run(async () => {
    const leagueName = parse(leagueNameSchema, input.leagueName);
    const playerName = parse(memberNameSchema, input.playerName);
    const pin = parse(pinSchema, input.pin);
    const ip = await clientIp();
    const key = `create:${ip}`;
    const locked = await lockedFor(key);
    if (locked) throw new UserError(lockMessage(locked));
    await hit(key, RULES.createLeague);

    const pinHash = await hashPin(pin);
    const sql = db();
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateCode();
      try {
        const { leagueId, memberId } = await sql.begin(async (tx) => {
          const [l] = await tx<{ id: string }[]>`
            insert into leagues (name, slug, join_code) values (${leagueName}, ${code}, ${code}) returning id`;
          const [m] = await tx<{ id: string }[]>`
            insert into members (league_id, name, pin_hash, is_creator)
            values (${l.id}, ${playerName}, ${pinHash}, true) returning id`;
          return { leagueId: l.id, memberId: m.id };
        });
        await signInAs(memberId, leagueId);
        slug = code;
        return { ok: true };
      } catch (e) {
        if (isUniqueViolation(e)) continue; // code collision: try another
        throw e;
      }
    }
    throw new UserError("Couldn't create a league code. Please try again.");
  });
  if (res.ok) redirect(`/l/${slug}/settings/games?welcome=1`);
  return res;
}

/** Step 1 of joining: check a code exists (rate-limited against guessing). */
export async function findLeague(input: { code: string }): Promise<ActionResult> {
  let code = "";
  const res = await run(async () => {
    const ip = await clientIp();
    const key = `code:${ip}`;
    const locked = await lockedFor(key);
    if (locked) throw new UserError(lockMessage(locked));
    code = parse(codeSchema, input.code);
    const rows = await db()`select 1 from leagues where join_code = ${code}`;
    if (rows.length === 0) {
      const lock = await hit(key, RULES.joinCode);
      throw new UserError(
        lock ? lockMessage(lock) : "No league has that code. Check it and try again.",
      );
    }
    return { ok: true };
  });
  if (res.ok) redirect(`/join/${code}`);
  return res;
}

async function leagueForCode(code: string) {
  const c = parse(codeSchema, code);
  const rows = await db()<
    { id: string; slug: string }[]
  >`select id, slug from leagues where join_code = ${c}`;
  if (!rows[0])
    throw new UserError(
      "That join code no longer works. Ask the league creator for the current one.",
    );
  return rows[0];
}

/** Join as a brand-new member. */
export async function joinAsNew(input: {
  code: string;
  name: string;
  pin: string;
}): Promise<ActionResult> {
  let slug = "";
  const res = await run(async () => {
    const name = parse(memberNameSchema, input.name);
    const pin = parse(pinSchema, input.pin);
    const ip = await clientIp();
    const key = `join:${ip}`;
    const locked = await lockedFor(key);
    if (locked) throw new UserError(lockMessage(locked));
    const league = await leagueForCode(input.code);
    await hit(key, RULES.newMember);
    try {
      const [m] = await db()<{ id: string }[]>`
        insert into members (league_id, name, pin_hash) values (${league.id}, ${name}, ${await hashPin(pin)})
        returning id`;
      await signInAs(m.id, league.id);
    } catch (e) {
      if (isUniqueViolation(e))
        throw new UserError(
          `“${name}” is already taken in this league. If that's you, choose “I've played before”.`,
        );
      throw e;
    }
    slug = league.slug;
    return { ok: true };
  });
  if (res.ok) redirect(`/l/${slug}/today`);
  return res;
}

/** Reclaim an existing name on a new device with its PIN. Locks after 5 wrong PINs for 15 minutes. */
export async function reclaimMember(input: {
  code: string;
  memberId: string;
  pin: string;
}): Promise<ActionResult> {
  let slug = "";
  const res = await run(async () => {
    const memberId = parse(uuidSchema, input.memberId);
    const pin = parse(z.string().max(10), input.pin);
    const league = await leagueForCode(input.code);
    const rows = await db()<{ id: string; name: string; pin_hash: string }[]>`
      select id, name, pin_hash from members where id = ${memberId} and league_id = ${league.id}`;
    const member = rows[0];
    if (!member) throw new UserError("That player isn't in this league anymore.");
    const ip = await clientIp();
    const key = `pin:${league.id}:${member.name.toLowerCase()}:${ip}`;
    const nameKey = `pinname:${league.id}:${member.name.toLowerCase()}`;
    const locked = Math.max(await lockedFor(key), await lockedFor(nameKey));
    if (locked) throw new UserError(lockMessage(locked));
    const ok = /^\d{4}$/.test(pin) && (await verifyPin(pin, member.pin_hash));
    if (!ok) {
      const lock = Math.max(await hit(key, RULES.pin), await hit(nameKey, RULES.pinPerName));
      if (lock) throw new UserError(`Wrong PIN. ${lockMessage(lock)}`);
      const [{ attempts }] = await db()<{ attempts: number }[]>`
        select attempts from rate_limits where key = ${key}`;
      const left = Math.max(0, RULES.pin.max - attempts);
      throw new UserError(
        `Wrong PIN. ${left} ${left === 1 ? "try" : "tries"} left before a 15-minute lockout.`,
      );
    }
    await clear(key);
    await signInAs(member.id, league.id);
    slug = league.slug;
    return { ok: true };
  });
  if (res.ok) redirect(`/l/${slug}/today`);
  return res;
}

export async function signOut(input: { slug: string }): Promise<ActionResult> {
  const res = await run(async () => {
    const me = await requireActor(input.slug);
    await signOutOf(me.leagueId);
    return { ok: true };
  });
  if (res.ok) redirect("/");
  return res;
}

export async function changeMyPin(input: {
  slug: string;
  currentPin: string;
  newPin: string;
}): Promise<ActionResult> {
  return run(async () => {
    const me = await requireActor(input.slug);
    const newPin = parse(pinSchema, input.newPin);
    const key = `pinchange:${me.memberId}`;
    const locked = await lockedFor(key);
    if (locked) throw new UserError(lockMessage(locked));
    const [m] = await db()<
      { pin_hash: string }[]
    >`select pin_hash from members where id = ${me.memberId}`;
    if (!(await verifyPin(String(input.currentPin), m.pin_hash))) {
      const lock = await hit(key, RULES.pin);
      throw new UserError(lock ? lockMessage(lock) : "Your current PIN is wrong.");
    }
    await db()`update members set pin_hash = ${await hashPin(newPin)} where id = ${me.memberId}`;
    await clear(key);
    return { ok: true };
  });
}
