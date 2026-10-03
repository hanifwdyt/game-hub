import { getGame, type Game } from "@/lib/games";
import { db } from "@/lib/db";
import { getUser, sameOrigin } from "@/lib/session";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const MAX_SAVE = 512 * 1024, KEEP_REVS = 10, MAX_PLAY_CHUNK = 120;
const day = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // Asia/Jakarta day boundary

type Ctx = { params: Promise<{ op?: string[] }> };

export async function GET(req: Request, ctx: Ctx) {
  const user = await getUser(req);
  const [op, gameId] = (await ctx.params).op ?? [];
  if (!op) return json(user ? { user, ...state(user.id) } : { user: null, games: {} }); // "nobody yet" is a normal answer, not an error (no console noise for every visitor)
  if (!user) return json({ error: "no session" }, 401);
  const d = db();
  if (op === "save" && gameId) {
    const slot = new URL(req.url).searchParams.get("slot") ?? "main";
    const row = d.prepare("SELECT rev, data, summary, updated_at AS updatedAt FROM save_slot WHERE user_id=? AND game_id=? AND slot=?").get(user.id, gameId, slot);
    return json(row ?? { rev: 0 });
  }
  return json({ error: "not found" }, 404);
}

export async function POST(req: Request, ctx: Ctx) {
  if (!sameOrigin(req)) return json({ error: "bad origin" }, 403);
  const user = await getUser(req);
  if (!user) return json({ error: "no session" }, 401);
  const [op, gameId] = (await ctx.params).op ?? [];
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const d = db();
  const now = Date.now();
  const game = async (id: unknown) => (typeof id === "string" ? await getGame(id) : null);

  if (op === "play") {
    const g = await game(b.gameId); if (!g) return json({ error: "unknown game" }, 400);
    const s = Math.max(0, Math.min(MAX_PLAY_CHUNK, Math.round(Number(b.seconds) || 0)));
    d.transaction(() => {
      d.prepare(`INSERT INTO user_game (user_id, game_id, playtime_s, sessions, last_played_at) VALUES (?,?,?,?,?)
        ON CONFLICT(user_id, game_id) DO UPDATE SET playtime_s = playtime_s + excluded.playtime_s, sessions = sessions + excluded.sessions, last_played_at = excluded.last_played_at`)
        .run(user.id, g.id, s, b.session ? 1 : 0, now);
      if (s) d.prepare(`INSERT INTO playtime_daily (user_id, game_id, day, active_s) VALUES (?,?,?,?)
        ON CONFLICT(user_id, game_id, day) DO UPDATE SET active_s = MIN(86400, active_s + excluded.active_s)`).run(user.id, g.id, day(), s);
    })();
    return json({ ok: true });
  }

  if (op === "favorite") {
    const g = await game(b.gameId); if (!g) return json({ error: "unknown game" }, 400);
    d.prepare(`INSERT INTO user_game (user_id, game_id, favorite) VALUES (?,?,?)
      ON CONFLICT(user_id, game_id) DO UPDATE SET favorite = excluded.favorite`).run(user.id, g.id, b.on ? 1 : 0);
    return json({ ok: true });
  }

  // one-time merge of what the browser already knew (before the guest row existed): keep the larger value
  if (op === "import") {
    const playtime = (b.playtime ?? {}) as Record<string, number>, sessions = (b.sessions ?? {}) as Record<string, number>;
    const favs = new Set(Array.isArray(b.favorites) ? b.favorites.map(String) : []);
    const up = d.prepare(`INSERT INTO user_game (user_id, game_id, playtime_s, sessions, favorite) VALUES (?,?,?,?,?)
      ON CONFLICT(user_id, game_id) DO UPDATE SET playtime_s = MAX(playtime_s, excluded.playtime_s), sessions = MAX(sessions, excluded.sessions), favorite = MAX(favorite, excluded.favorite)`);
    const valid: string[] = [];
    for (const id of new Set([...Object.keys(playtime), ...Object.keys(sessions), ...favs])) if (await game(id)) valid.push(id);
    d.transaction(() => { // better-sqlite3 transactions must be synchronous, so games are resolved above
      for (const id of valid) up.run(user.id, id, Math.max(0, Math.round(Number(playtime[id]) || 0)), Math.max(0, Math.round(Number(sessions[id]) || 0)), favs.has(id) ? 1 : 0);
    })();
    return json({ ok: true, ...state(user.id) });
  }

  if (op === "save" && gameId) {
    const g = await getGame(gameId); if (!g) return json({ error: "unknown game" }, 400);
    const slot = typeof b.slot === "string" && /^[a-z0-9_-]{1,32}$/i.test(b.slot) ? b.slot : "main";
    const data = typeof b.data === "string" ? b.data : JSON.stringify(b.data ?? {});
    if (Buffer.byteLength(data) > MAX_SAVE) return json({ error: "save too large (max 512 KiB)" }, 413);
    const baseRev = Number(b.baseRev) || 0;
    const device = typeof b.device === "string" ? b.device.slice(0, 80) : null;
    const summary = typeof b.summary === "string" ? b.summary.slice(0, 200) : null;
    const out = d.transaction(() => {
      const cur = d.prepare("SELECT rev FROM save_slot WHERE user_id=? AND game_id=? AND slot=?").get(user.id, g.id, slot) as { rev: number } | undefined;
      const rev = (cur?.rev ?? 0) + 1;
      // last-write-wins; every revision is kept (last 10) so a clobbered save can be restored
      d.prepare(`INSERT INTO save_slot (user_id, game_id, slot, rev, data, summary, device, updated_at) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(user_id, game_id, slot) DO UPDATE SET rev=excluded.rev, data=excluded.data, summary=excluded.summary, device=excluded.device, updated_at=excluded.updated_at`)
        .run(user.id, g.id, slot, rev, data, summary, device, now);
      d.prepare("INSERT INTO save_revision (user_id, game_id, slot, rev, data, device, created_at) VALUES (?,?,?,?,?,?,?)").run(user.id, g.id, slot, rev, data, device, now);
      d.prepare("DELETE FROM save_revision WHERE user_id=? AND game_id=? AND slot=? AND rev <= ?").run(user.id, g.id, slot, rev - KEEP_REVS);
      return { rev, conflict: !!cur && cur.rev !== baseRev };
    })();
    return json({ ok: true, ...out });
  }

  if (op === "progress" && gameId) {
    const g = await getGame(gameId); if (!g) return json({ error: "unknown game" }, 400);
    return json(applyProgress(user.id, g, b, now));
  }
  return json({ error: "not found" }, 404);
}

/** Record milestones / achievements / stats reported by the game or read from its storage. Unknown ids are ignored. */
function applyProgress(userId: string, g: Game, b: Record<string, unknown>, now: number) {
  const d = db();
  const validM = new Set(g.progress?.milestones.map((m) => m.id) ?? []);
  const defs = new Map(g.achievements.map((a) => [a.id, a]));
  const unlocked: string[] = [];
  d.transaction(() => {
    for (const id of Array.isArray(b.milestones) ? b.milestones.map(String) : [])
      if (validM.has(id)) d.prepare("INSERT OR IGNORE INTO milestone (user_id, game_id, milestone_id, cleared_at) VALUES (?,?,?,?)").run(userId, g.id, id, now);
    const stats = (b.stats ?? {}) as Record<string, unknown>;
    for (const [name, v] of Object.entries(stats).slice(0, 20)) {
      const inc = Number(v); if (!Number.isFinite(inc) || !/^[a-z0-9_.-]{1,40}$/i.test(name)) continue;
      d.prepare(`INSERT INTO user_stat (user_id, game_id, name, value) VALUES (?,?,?,?)
        ON CONFLICT(user_id, game_id, name) DO UPDATE SET value = value + excluded.value`).run(userId, g.id, name, inc);
    }
    const ids = new Set(Array.isArray(b.achievements) ? b.achievements.map(String) : []);
    for (const a of g.achievements) { // stat-driven achievements unlock themselves at their threshold
      if (a.stat && a.threshold != null) {
        const row = d.prepare("SELECT value FROM user_stat WHERE user_id=? AND game_id=? AND name=?").get(userId, g.id, a.stat) as { value: number } | undefined;
        if (row && row.value >= a.threshold) ids.add(a.id);
      }
    }
    for (const a of g.achievements) { // milestone-driven achievements ("clear chapter 2") need no game code
      if (a.milestone && d.prepare("SELECT 1 FROM milestone WHERE user_id=? AND game_id=? AND milestone_id=?").get(userId, g.id, a.milestone)) ids.add(a.id);
    }
    for (const id of ids) {
      if (!defs.has(id)) continue;
      if (d.prepare("INSERT OR IGNORE INTO achievement_unlock (user_id, game_id, achievement_id, unlocked_at) VALUES (?,?,?,?)").run(userId, g.id, id, now).changes) unlocked.push(id);
    }
  })();
  return { ok: true, unlocked: unlocked.map((id) => ({ id, name: defs.get(id)!.name, desc: defs.get(id)!.desc, points: defs.get(id)!.points })), ...state(userId) };
}

function state(userId: string) {
  const d = db();
  const games: Record<string, { playtime: number; sessions: number; last: number | null; favorite: boolean; cleared: string[]; achievements: string[] }> = {};
  const row = (id: string) => (games[id] ??= { playtime: 0, sessions: 0, last: null, favorite: false, cleared: [], achievements: [] });
  for (const r of d.prepare("SELECT * FROM user_game WHERE user_id=?").all(userId) as { game_id: string; playtime_s: number; sessions: number; last_played_at: number | null; favorite: number }[]) {
    Object.assign(row(r.game_id), { playtime: r.playtime_s, sessions: r.sessions, last: r.last_played_at, favorite: !!r.favorite });
  }
  for (const r of d.prepare("SELECT game_id, milestone_id FROM milestone WHERE user_id=?").all(userId) as { game_id: string; milestone_id: string }[]) row(r.game_id).cleared.push(r.milestone_id);
  for (const r of d.prepare("SELECT game_id, achievement_id FROM achievement_unlock WHERE user_id=?").all(userId) as { game_id: string; achievement_id: string }[]) row(r.game_id).achievements.push(r.achievement_id);
  return { games };
}
