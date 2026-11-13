import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "./db";

/**
 * Device identity. The httpOnly cookie holds a signed list of raw session tokens
 * (one per league membership on this device). The DB stores only SHA-256 hashes.
 */
const COOKIE = "dl_device";
const MAX_AGE = 400 * 24 * 60 * 60; // browsers cap cookies at 400 days
const MAX_TOKENS = 20;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function readTokens(): Promise<string[]> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return [];
  try {
    const { payload } = await jwtVerify(raw, secret(), { algorithms: ["HS256"] });
    const t = (payload as { t?: unknown }).t;
    return Array.isArray(t)
      ? t.filter((x): x is string => typeof x === "string").slice(0, MAX_TOKENS)
      : [];
  } catch {
    return [];
  }
}

async function writeTokens(tokens: string[]): Promise<void> {
  const jar = await cookies();
  if (tokens.length === 0) {
    jar.delete(COOKIE);
    return;
  }
  const jwt = await new SignJWT({ t: tokens.slice(-MAX_TOKENS) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(secret());
  jar.set(COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export interface Membership {
  sessionId: string;
  token: string;
  memberId: string;
  memberName: string;
  isCreator: boolean;
  leagueId: string;
  leagueName: string;
  slug: string;
}

/** All league memberships this device is signed in to (deduped per request). */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const tokens = await readTokens();
  if (tokens.length === 0) return [];
  const byHash = new Map(tokens.map((t) => [hashToken(t), t]));
  const rows = await db()<
    {
      session_id: string;
      token_hash: string;
      member_id: string;
      member_name: string;
      is_creator: boolean;
      league_id: string;
      league_name: string;
      slug: string;
      stale: boolean;
    }[]
  >`
    select s.id as session_id, s.token_hash, m.id as member_id, m.name as member_name, m.is_creator,
           l.id as league_id, l.name as league_name, l.slug,
           s.last_seen_at < now() - interval '1 hour' as stale
    from member_sessions s
    join members m on m.id = s.member_id
    join leagues l on l.id = m.league_id
    where s.token_hash in ${db()([...byHash.keys()])}
    order by l.name`;
  const staleIds = rows.filter((r) => r.stale).map((r) => r.session_id);
  if (staleIds.length) {
    await db()`update member_sessions set last_seen_at = now() where id in ${db()(staleIds)}`;
  }
  return rows.map((r) => ({
    sessionId: r.session_id,
    token: byHash.get(r.token_hash)!,
    memberId: r.member_id,
    memberName: r.member_name,
    isCreator: r.is_creator,
    leagueId: r.league_id,
    leagueName: r.league_name,
    slug: r.slug,
  }));
});

export async function getMembershipBySlug(slug: string): Promise<Membership | null> {
  return (await getMemberships()).find((m) => m.slug === slug) ?? null;
}

/** Creates a device session for a member and stores it in the cookie (server actions only). */
export async function signInAs(memberId: string, leagueId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await db()`insert into member_sessions (member_id, token_hash) values (${memberId}, ${hashToken(token)})`;
  const current = await getMemberships();
  // Drop any other identity this device had in the same league, and dead tokens.
  const replaced = current.filter((m) => m.leagueId === leagueId && m.memberId !== memberId);
  if (replaced.length) {
    await db()`delete from member_sessions where id in ${db()(replaced.map((m) => m.sessionId))}`;
  }
  const keep = current.filter((m) => m.leagueId !== leagueId).map((m) => m.token);
  await writeTokens([...keep, token]);
}

/** Signs this device out of one league. */
export async function signOutOf(leagueId: string): Promise<void> {
  const current = await getMemberships();
  const mine = current.filter((m) => m.leagueId === leagueId);
  if (mine.length)
    await db()`delete from member_sessions where id in ${db()(mine.map((m) => m.sessionId))}`;
  await writeTokens(current.filter((m) => m.leagueId !== leagueId).map((m) => m.token));
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

// A valid hash to compare against when the name doesn't exist, so timing is the same.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.4bA5i1O3rY1x0H1mQp5i2xKZxH9e";

export async function verifyPin(pin: string, hash: string | null): Promise<boolean> {
  const ok = await bcrypt.compare(pin, hash ?? DUMMY_HASH);
  return hash !== null && ok;
}
