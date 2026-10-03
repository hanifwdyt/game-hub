import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Single SQLite file (data/hub.db). Holds Better Auth's tables plus the hub's own player data.
 * Plenty for a community-sized hub; the table layout mirrors docs/research/02 so a move to Postgres is mechanical.
 */
const g = globalThis as unknown as { __hubDb?: Database.Database };

export function db() {
  if (g.__hubDb) return g.__hubDb;
  const file = process.env.HUB_DB ?? path.join(process.cwd(), "data", "hub.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const d = new Database(file);
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  d.pragma("busy_timeout = 5000");
  migrate(d);
  g.__hubDb = d;
  return d;
}

// Hub tables. user_id references Better Auth's "user"(id); we do not declare the FK because that table is created by
// Better Auth's own migration (which runs separately).
const MIGRATIONS: string[] = [
  `CREATE TABLE user_game (
     user_id TEXT NOT NULL, game_id TEXT NOT NULL,
     playtime_s INTEGER NOT NULL DEFAULT 0, sessions INTEGER NOT NULL DEFAULT 0,
     last_played_at INTEGER, favorite INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (user_id, game_id));
   CREATE TABLE playtime_daily (
     user_id TEXT NOT NULL, game_id TEXT NOT NULL, day TEXT NOT NULL, active_s INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (user_id, game_id, day));
   CREATE TABLE save_slot (
     user_id TEXT NOT NULL, game_id TEXT NOT NULL, slot TEXT NOT NULL,
     rev INTEGER NOT NULL, data TEXT NOT NULL, summary TEXT, device TEXT, updated_at INTEGER NOT NULL,
     PRIMARY KEY (user_id, game_id, slot));
   CREATE TABLE save_revision (
     user_id TEXT NOT NULL, game_id TEXT NOT NULL, slot TEXT NOT NULL, rev INTEGER NOT NULL,
     data TEXT NOT NULL, device TEXT, created_at INTEGER NOT NULL,
     PRIMARY KEY (user_id, game_id, slot, rev));
   CREATE TABLE milestone (
     user_id TEXT NOT NULL, game_id TEXT NOT NULL, milestone_id TEXT NOT NULL, cleared_at INTEGER NOT NULL,
     PRIMARY KEY (user_id, game_id, milestone_id));
   CREATE TABLE achievement_unlock (
     user_id TEXT NOT NULL, game_id TEXT NOT NULL, achievement_id TEXT NOT NULL, unlocked_at INTEGER NOT NULL,
     PRIMARY KEY (user_id, game_id, achievement_id));
   CREATE TABLE user_stat (
     user_id TEXT NOT NULL, game_id TEXT NOT NULL, name TEXT NOT NULL, value REAL NOT NULL DEFAULT 0,
     PRIMARY KEY (user_id, game_id, name));`,
];

function migrate(d: Database.Database) {
  const v = d.pragma("user_version", { simple: true }) as number;
  for (let i = v; i < MIGRATIONS.length; i++) {
    d.transaction(() => { d.exec(MIGRATIONS[i]); d.pragma(`user_version = ${i + 1}`); })();
  }
}
