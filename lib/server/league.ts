import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Direction, InputType } from "@/lib/catalog-data";
import type { PlainDate } from "@/lib/dates";
import type { ScoreRow } from "@/lib/scoring";
import { db } from "./db";
import { getMembershipBySlug, type Membership } from "./session";

export interface League {
  id: string;
  name: string;
  slug: string;
  join_code: string;
  points_table: number[];
  created_at: Date;
}

export interface Member {
  id: string;
  name: string;
  is_creator: boolean;
  created_at: Date;
}

export interface LeagueGame {
  id: string;
  catalog_key: string | null;
  name: string;
  entry_prompt: string;
  entry_example: string;
  input_type: InputType;
  min: number;
  max: number;
  direction: Direction;
  allow_fail: boolean;
  color: string;
  sort_order: number;
  url: string | null;
  unit_label: string | null;
  archived_at: Date | null;
}

export interface ScoreRecord extends ScoreRow {
  id: string;
  updatedAt: Date;
}

export const getLeague = cache(async (leagueId: string): Promise<League | null> => {
  const rows = await db()<League[]>`
    select id, name, slug, join_code, points_table, created_at from leagues where id = ${leagueId}`;
  return rows[0] ?? null;
});

export const getMembers = cache(async (leagueId: string): Promise<Member[]> => {
  return db()<Member[]>`
    select id, name, is_creator, created_at from members
    where league_id = ${leagueId} order by lower(name)`;
});

export const getGames = cache(async (leagueId: string): Promise<LeagueGame[]> => {
  return db()<LeagueGame[]>`
    select id, catalog_key, name, entry_prompt, entry_example, input_type, min, max, direction,
           allow_fail, color, sort_order, url, unit_label, archived_at
    from league_games where league_id = ${leagueId}
    order by sort_order, created_at`;
});

export async function getScores(
  leagueId: string,
  range: { from?: PlainDate | null; to?: PlainDate | null } = {},
): Promise<ScoreRecord[]> {
  const from = range.from ?? "0001-01-01";
  const to = range.to ?? "9999-12-31";
  const rows = await db()<
    {
      id: string;
      member_id: string;
      game_id: string;
      play_date: string;
      value: number | null;
      failed: boolean;
      updated_at: Date;
    }[]
  >`
    select id, member_id, game_id, play_date, value, failed, updated_at from scores
    where league_id = ${leagueId} and play_date between ${from} and ${to}
    order by play_date, game_id`;
  return rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    gameId: r.game_id,
    date: r.play_date,
    value: r.value,
    failed: r.failed,
    updatedAt: r.updated_at,
  }));
}

export interface LeagueContext {
  me: Membership;
  league: League;
  members: Member[];
  games: LeagueGame[]; // all, including archived
  activeGames: LeagueGame[];
  memberName: Map<string, string>;
}

/** Loads the league for a page, or redirects to join if this device isn't a member. */
export const requireLeague = cache(async (slug: string): Promise<LeagueContext> => {
  const me = await getMembershipBySlug(slug);
  if (!me) redirect(`/join?league=${encodeURIComponent(slug)}`);
  const [league, members, games] = await Promise.all([
    getLeague(me.leagueId),
    getMembers(me.leagueId),
    getGames(me.leagueId),
  ]);
  if (!league) redirect("/");
  return {
    me,
    league,
    members,
    games,
    activeGames: games.filter((g) => !g.archived_at),
    memberName: new Map(members.map((m) => [m.id, m.name])),
  };
});
