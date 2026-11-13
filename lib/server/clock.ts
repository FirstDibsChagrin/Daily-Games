import "server-only";
import { cookies } from "next/headers";
import { gameDayOf, type PlainDate } from "@/lib/dates";

export const TEST_CLOCK_COOKIE = "dl_test_now";

/**
 * Current instant. When ALLOW_TEST_CLOCK=1 (tests only, never production) a
 * `dl_test_now` cookie holding an ISO timestamp overrides the clock.
 */
export async function now(): Promise<Date> {
  if (process.env.ALLOW_TEST_CLOCK === "1") {
    const v = (await cookies()).get(TEST_CLOCK_COOKIE)?.value;
    if (v) {
      const d = new Date(decodeURIComponent(v));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}

/** Today's game day in America/New_York. */
export async function today(): Promise<PlainDate> {
  return gameDayOf(await now());
}
