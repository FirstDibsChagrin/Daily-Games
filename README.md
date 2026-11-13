# Daily League

A daily-puzzle score tracker for friend groups. Friends log their scores from Wordle,
Connections, Krillion and other daily games, earn points per game per day, and compete on
live leaderboards with streaks, badges, weekly champions and recaps.

- **No accounts.** Create a league (name + your name + 4-digit PIN), share the 6-character
  join code or link, and friends join with a name and PIN. Each device stays signed in.
- **Points are never stored.** They are computed live from raw scores, so edits, backfills,
  deleted scores and game changes correct everything automatically.
- **Mobile-first**, dark by default, installable as a PWA. Runs on Vercel Hobby + Supabase free.

## How scoring works

For each game, each day (America/New_York game day, rolling over at midnight ET):

1. Fewer than 2 players with a score: no points ("waiting for a second player").
2. Players are ranked by the game's direction with standard competition ranking (1, 1, 3, 4).
3. Points come from the league's points table (default `5, 3, 2, 1`; 4th and below get the
   last value). Ties share the full points for their rank.
4. An "X / didn't finish" ranks below everyone and gets the last value. It still counts as played.
5. Winners are the rank-1 non-X players. Every game counts equally.

Weekly champion (Mon–Sun ET): most points. Ties go to the player with more 1st-place finishes;
anyone still tied is a co-champion. A week with no points has no champion.

## Tech

Next.js 16 (App Router, TypeScript strict) · Tailwind CSS 4 · shadcn/ui-style components on
Radix · Postgres (Supabase) via `postgres` · zod · jose · bcryptjs · date-fns-tz · Recharts ·
motion · canvas-confetti · Vitest · Playwright.

```
app/                 routes (public pages, /l/[slug]/… league pages, server actions, cron API)
components/          UI (components/ui = shadcn-style primitives, components/league = app widgets)
lib/                 pure logic: dates, score parsing, catalog data, validation
lib/scoring/         points engine, streaks, weeks/champions, badges, recaps (all unit-tested)
lib/server/          server-only: db client, sessions/PINs, rate limits, data loaders, badge sync
supabase/migrations/ SQL schema (RLS on every table)
supabase/seed.sql    catalog seed (generated from lib/catalog-data.ts)
scripts/             migrate + seed runners
tests/unit/          Vitest unit tests
tests/e2e/           Playwright end-to-end tests
```

## Environment variables

| Variable | Where | What |
|---|---|---|
| `DATABASE_URL` | Vercel + local | Postgres connection for the app (server only). In production, the Supabase **transaction pooler** URL for the `daily_league_app` role: `postgres://daily_league_app.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres` |
| `SESSION_SECRET` | Vercel + local | 32+ random characters used to sign device cookies (`openssl rand -base64 32`) |
| `CRON_SECRET` | Vercel | Random string. Vercel Cron sends it as `Authorization: Bearer …` to `/api/cron/keepalive` |
| `DATABASE_ADMIN_URL` | local only (optional) | Admin connection used by `db:migrate` / `db:seed`. Falls back to `DATABASE_URL` |
| `APP_ROLE_PASSWORD` | local only (optional) | Lets `db:migrate` set the local app role's password |
| `ALLOW_TEST_CLOCK` | tests only | `1` lets e2e tests fake the clock with a cookie. **Never set in production.** |

See `.env.example`. Secrets are never committed.

## Run locally

Requires Node 20+ and a Postgres 15+ database (a local Postgres or a Supabase project).

```bash
npm install
cp .env.example .env          # then edit the values
npm run db:migrate            # creates tables, RLS policies and the daily_league_app role
npm run db:seed               # loads the game catalog
npm run dev                   # http://localhost:3000
```

Checks:

```bash
npm run typecheck
npm run lint
npm test                      # unit tests (Vitest)
npm run test:e2e              # end-to-end (Playwright): builds the app and uses the
                              # daily_league_test database (see playwright.config.ts)
npm run build
```

## Deploy

1. **Supabase**: create a free project (region `us-east-1` is closest to Vercel's default).
   Apply `supabase/migrations/*.sql`, then `supabase/seed.sql` (SQL editor, `npm run db:migrate`
   and `npm run db:seed` with `DATABASE_ADMIN_URL`, or the Supabase MCP). Then give the app role
   a password (SQL editor): `alter role daily_league_app login password '<long random password>';`
2. **Vercel**: import the GitHub repo (framework: Next.js). Add `DATABASE_URL` (pooler URL
   above, port 6543), `SESSION_SECRET` and `CRON_SECRET` for Production. Deploy.
3. The keep-alive cron is declared in `vercel.json` (daily at 09:17 UTC). Check it under
   Project → Settings → Cron Jobs. It runs a trivial query so the free Supabase project never
   pauses for inactivity. It also prunes old rate-limit rows and refreshes weekly badges.

### Security model

- All reads and writes go through server code (server components and server actions). The
  browser never receives a database credential.
- The app connects as the dedicated `daily_league_app` role. RLS is enabled on every table, and
  the only policies are for that role. Supabase's `anon`/`authenticated` roles have no grants or
  policies, so the public API keys can read nothing.
- Each device holds an httpOnly cookie with a signed (HS256) list of random session tokens.
  Only SHA-256 hashes of the tokens are stored. PINs are bcrypt-hashed.
- Every write checks: valid session → member of this league → owns the score / is the creator.
  Every input is validated with zod on the server (and on the client, for friendly messages).
- Rate limits live in the database (`rate_limits`): 5 wrong PINs per (league, name, IP) locks
  that name for 15 minutes, plus a 30/hour per-name cap across IPs. Failed join-code lookups
  (10 per 15 min per IP), league creation and joins are also throttled.

## Adding or fixing catalog games

The catalog lives in `lib/catalog-data.ts`. Edit or add an entry (unique `key`, a distinct
`color`, the exact `entry_prompt` players will see, and an `entry_example`), then run:

```bash
npm run db:seed:sql   # regenerates supabase/seed.sql
npm run db:seed       # upserts into the database (DATABASE_ADMIN_URL or DATABASE_URL)
```

Seeding updates the global catalog only. Leagues that already added a game keep their own
copy, so creators can edit theirs in-app (League → Manage games).

## Needs confirmation

These catalog games are seeded with `verified = false` (shown with an "unverified" tag in the
catalog). I couldn't confirm their scoring from public sources. League creators can edit any
field in-app.

- **Noillirk**: seeded as a decimal 0–14 "km" climb, higher wins. Confirm the unit and number
  on the results screen.
- **Daily Holes**: seeded as total strokes 1–200, lower wins. If the share shows strokes vs
  par, change it to allow negatives.
- **Eraly**: seeded as a 0–100000 score, higher wins. Confirm what it reports and which
  direction wins.

**Range Squeeze** and **Play Plain** are verified (points scored), but I couldn't find their real
maximums, so the max is 100000. Official links are filled in only for Wordle, Connections and
Waffle, the only ones I'm certain of.

## Assumptions

Decisions I made where the spec was silent:

- **Database access** uses a Postgres connection string for a dedicated `daily_league_app`
  role instead of supabase-js with the service-role key. It's equivalent server-only access,
  works with the transaction pooler on Vercel, and lets tests run against plain Postgres.
- **League URLs** use a permanent 6-character slug (the league's first join code). The join code
  can be regenerated without breaking bookmarks. League pages require membership on that
  device, so a URL alone doesn't grant access.
- **Only the creator sees the join code.** Members see "Ask <creator> for the join code".
- **"Games played" and "Avg"** in standings count only game-days that were scored (2+ players).
  A lone submission doesn't drag down your average.
- **Standings ties** share a rank only when points and 1st-place finishes are equal (the same rule
  as weekly champions).
- **Archived games** are hidden from entry, boards, stats and badges. Their scores are kept and
  come back on restore.
- **Badges** are recomputed from data after every score or game change, on stats, profile and
  recap visits, and by the daily cron. A badge's date is the game day it was earned (shown in
  recaps). Badges revoke automatically when the data no longer supports them. Completionist uses
  the league's *current* active games. Day Sweep ignores games where you were the only player
  (you need 3+ contested games and won them all). Comeback Kid's "last place" means the lowest
  points among players who scored that week (2+ players; nobody is last if everyone ties).
- **Streak in a recap** = the longest participation run active at any point that week, counting
  days before the week.
- **Removing a member** deletes their scores and badges, so standings recalculate.
- **Resetting a member's PIN** signs out their other devices and clears their lockout.
- **First visit** follows the device's light/dark setting. Dark is the design default; the
  toggle remembers your choice.
- **Score input**: time games accept `m:ss`, `h:mm:ss` or digits (typing `235` becomes `2:35`).
  Golf-style games have a ± key because phone number pads lack a minus. Past days go back to
  2000-01-01; future days are always rejected on the server.
- **The keep-alive cron** runs once a day (Hobby plans allow daily crons).
- **PWA**: the service worker only enables install and shows an offline notice. It never
  caches scores, so data is always live.
- **No starter games** are added on league creation. The creator lands on the games screen with
  a welcome note.
