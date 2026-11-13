import "server-only";
import { unstable_rethrow } from "next/navigation";
import { getMembershipBySlug, type Membership } from "./session";

export type ActionResult<T extends object = object> =
  ({ ok: true } & T) | { ok: false; error: string };

/** An error whose message is safe to show to the user. */
export class UserError extends Error {}

/** Runs an action body, turning thrown UserErrors into { ok: false } results. */
export async function run<T extends object>(
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    unstable_rethrow(e); // let redirect()/notFound() through
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function requireActor(slug: unknown): Promise<Membership> {
  const me = typeof slug === "string" ? await getMembershipBySlug(slug) : null;
  if (!me) throw new UserError("You're not signed in to this league on this device.");
  return me;
}

export async function requireCreator(slug: unknown): Promise<Membership> {
  const me = await requireActor(slug);
  if (!me.isCreator) throw new UserError("Only the league creator can do that.");
  return me;
}

/** Postgres unique-violation check. */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}
