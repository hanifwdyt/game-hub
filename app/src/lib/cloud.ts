"use client";
/**
 * Browser side of the hub's player data: account state, playtime, cloud save, progress, achievements.
 * localStorage stays the working copy (instant, offline-proof); the server copy is what follows the player to other
 * devices. Games run same-origin, so the hub can read and write their localStorage keys directly (see game.json saveKeys).
 */
import { useSyncExternalStore } from "react";
import type { Game } from "@/lib/games";
import { authClient } from "./auth-client";
import { player } from "./store";
import { toast } from "@/components/Toast";

export interface CloudUser { id: string; name: string; username: string | null; isGuest: boolean }
export interface ServerGame { playtime: number; sessions: number; last: number | null; favorite: boolean; cleared: string[]; achievements: string[] }
interface CloudState { loaded: boolean; user: CloudUser | null; games: Record<string, ServerGame> }

let state: CloudState = { loaded: false, user: null, games: {} };
const subs = new Set<() => void>();
const set = (s: Partial<CloudState>) => { state = { ...state, ...s }; subs.forEach((f) => f()); };
export function useCloud() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state, () => state);
}

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* quota / private mode */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  keys: () => { try { return Object.keys(localStorage); } catch { return [] as string[]; } },
};

async function api<T = unknown>(path: string, body?: unknown, keepalive = false): Promise<T | null> {
  try {
    const r = await fetch(`/api/me${path}`, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}

let loadedResolve: () => void;
const loadedP = new Promise<void>((r) => { loadedResolve = r; });
let refreshing: Promise<void> | null = null;

/** fold server data into the local store (bigger number wins, favourites are a union) so a new device shows the player's history */
function adopt(games: Record<string, ServerGame>) { player.mergeServer(games); }

export const cloud = {
  whenLoaded: () => loadedP,
  get: () => state,

  refresh(): Promise<void> {
    return (refreshing ??= (async () => {
      const r = await api<{ user: CloudUser | null; games: Record<string, ServerGame> }>("");
      if (r) { set({ loaded: true, user: r.user, games: r.games }); if (r.user) adopt(r.games); }
      else set({ loaded: true, user: null });
      loadedResolve();
    })().finally(() => { refreshing = null; }));
  },

  /** Guest accounts are created lazily — first real play, never on page view. Local history is carried over once. */
  async ensureGuest() {
    await loadedP;
    if (state.user) return state.user;
    const { error } = await authClient.signIn.anonymous();
    if (error) return null;
    const s = player.get();
    await api("/import", { playtime: s.playtime, sessions: s.sessions, favorites: s.favorites });
    await cloud.refresh();
    return state.user;
  },

  play(id: string, seconds: number, session = false) {
    if (state.user && (seconds > 0 || session)) void api("/play", { gameId: id, seconds, session });
  },
  favorite(id: string, on: boolean) { if (state.user) void api("/favorite", { gameId: id, on }); },

  // ---- cloud save: the game's own localStorage keys (by prefix) <-> one JSON blob per player per game
  async hydrate(game: Game) {
    if (!game.saveKeys.length) return;
    await loadedP;
    if (!state.user) return;
    const s = await api<{ rev: number; data?: string }>(`/save/${game.id}?slot=main`);
    const localRev = Number(ls.get(`hp:saverev:${game.id}`) ?? 0);
    if (!s || !s.data || s.rev <= localRev) return;
    try {
      const blob = JSON.parse(s.data) as Record<string, string>;
      for (const k of ls.keys()) if (game.saveKeys.some((p) => k.startsWith(p)) && !(k in blob)) ls.del(k);
      for (const [k, v] of Object.entries(blob)) ls.set(k, v);
      ls.set(`hp:saverev:${game.id}`, String(s.rev));
      ls.set(`hp:savehash:${game.id}`, hash(s.data));
    } catch { /* corrupt blob — keep local */ }
  },

  async push(game: Game, keepalive = false) {
    if (!game.saveKeys.length || !state.user) return;
    const blob: Record<string, string> = {};
    for (const k of ls.keys().sort()) if (game.saveKeys.some((p) => k.startsWith(p))) { const v = ls.get(k); if (v != null) blob[k] = v; }
    if (!Object.keys(blob).length) return;
    const data = JSON.stringify(blob), h = hash(data);
    if (ls.get(`hp:savehash:${game.id}`) === h) return;
    const r = await api<{ rev: number; conflict: boolean }>(`/save/${game.id}`, {
      slot: "main", data, baseRev: Number(ls.get(`hp:saverev:${game.id}`) ?? 0), device: deviceName(), summary: progressSummary(game),
    }, keepalive);
    if (r) { ls.set(`hp:saverev:${game.id}`, String(r.rev)); ls.set(`hp:savehash:${game.id}`, h); }
  },

  // ---- progress & achievements
  async progress(game: Game, body: { milestones?: string[]; achievements?: string[]; stats?: Record<string, number> }) {
    if (!state.user) await cloud.ensureGuest();
    if (!state.user) return;
    const r = await api<{ unlocked: { name: string; points: number }[]; games: Record<string, ServerGame> }>(`/progress/${game.id}`, body);
    if (!r) return;
    set({ games: r.games });
    for (const a of r.unlocked) toast(`Achievement unlocked · ${a.name} (+${a.points})`);
  },

  /** For games that were never changed to call hp.progress: read their own save format as declared in game.json. */
  syncProgressFromStorage(game: Game) {
    const src = game.progress?.source;
    if (!src) return;
    const raw = ls.get(src.storage);
    if (!raw) return;
    let ids: string[] = [];
    try {
      let v: unknown = JSON.parse(raw);
      if (src.path) v = (v as Record<string, unknown>)?.[src.path];
      if (src.kind === "array" && Array.isArray(v)) ids = v.map(String);
      else if (src.kind === "keys" && v && typeof v === "object") ids = Object.keys(v).filter((k) => (v as Record<string, unknown>)[k]);
    } catch { return; }
    ids = ids.map((x) => (src.prefix ?? "") + x);
    const sentKey = `hp:progsent:${game.id}`;
    const sent = new Set<string>(JSON.parse(ls.get(sentKey) ?? "[]"));
    const fresh = ids.filter((i) => !sent.has(i));
    if (!fresh.length) return;
    void cloud.progress(game, { milestones: fresh }).then(() => { if (state.user) ls.set(sentKey, JSON.stringify([...new Set([...sent, ...ids])])); });
  },

  async signOut() { await authClient.signOut(); set({ user: null, games: {} }); await cloud.refresh(); },
};

/** 0..1 share of the game's milestone weight the player has cleared, or null when the game declares no progress */
export function completion(game: Pick<Game, "progress">, cleared: string[] = []) {
  const ms = game.progress?.milestones;
  if (!ms?.length) return null;
  const total = ms.reduce((a, m) => a + m.weight, 0), done = ms.filter((m) => cleared.includes(m.id)).reduce((a, m) => a + m.weight, 0);
  return total ? done / total : null;
}

/** short label shown in the save-slot list, e.g. "Chapter 2 of 3" */
function progressSummary(game: Game) {
  const ms = game.progress?.milestones;
  if (!ms?.length) return undefined;
  const cleared = state.games[game.id]?.cleared.length ?? 0;
  return `${cleared} of ${ms.length} cleared`;
}

function deviceName() { return /Mobi|Android/i.test(navigator.userAgent) ? "Mobile" : "Desktop"; }
function hash(s: string) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); }
