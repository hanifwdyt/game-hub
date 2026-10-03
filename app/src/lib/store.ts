"use client";
/**
 * Per-player state kept in the browser: play history, playtime, favourites, settings.
 * Small, synchronous, and reactive via useSyncExternalStore.
 */
import { useSyncExternalStore } from "react";
import { cloud } from "./cloud";

export interface PlayerState {
  recent: { id: string; at: number }[];
  playtime: Record<string, number>; // seconds
  sessions: Record<string, number>;
  favorites: string[];
  settings: { sound: boolean };
}

const KEY = "hanif-play:v1";
const EMPTY: PlayerState = { recent: [], playtime: {}, sessions: {}, favorites: [], settings: { sound: true } };

let state: PlayerState = EMPTY;
let loaded = false;
const subs = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...EMPTY, ...JSON.parse(raw), settings: { ...EMPTY.settings, ...JSON.parse(raw).settings } };
  } catch {
    state = EMPTY;
  }
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    subs.forEach((f) => f());
  });
}

function commit(next: PlayerState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — keep the in-memory copy */
  }
  subs.forEach((f) => f());
}

export function usePlayer(): PlayerState {
  return useSyncExternalStore(
    (f) => {
      load();
      subs.add(f);
      return () => subs.delete(f);
    },
    () => (load(), state),
    () => EMPTY,
  );
}

export const player = {
  get: () => (load(), state),
  startSession(id: string) {
    load();
    // ignore a duplicate start within a few seconds (React dev double-mount, quick reloads)
    if (state.recent[0]?.id === id && Date.now() - state.recent[0].at < 4000) return;
    const recent = [{ id, at: Date.now() }, ...state.recent.filter((r) => r.id !== id)].slice(0, 30);
    commit({ ...state, recent, sessions: { ...state.sessions, [id]: (state.sessions[id] ?? 0) + 1 } });
  },
  addPlaytime(id: string, seconds: number) {
    load();
    if (seconds <= 0) return;
    commit({ ...state, playtime: { ...state.playtime, [id]: (state.playtime[id] ?? 0) + Math.round(seconds) } });
  },
  toggleFavorite(id: string) {
    load();
    const has = state.favorites.includes(id);
    commit({ ...state, favorites: has ? state.favorites.filter((f) => f !== id) : [id, ...state.favorites] });
    cloud.favorite(id, !has);
    return !has;
  },
  /** fold the account's data from the server in: larger counters win, favourites are a union, "recent" follows last_played */
  mergeServer(games: Record<string, { playtime: number; sessions: number; last: number | null; favorite: boolean }>) {
    load();
    const playtime = { ...state.playtime }, sessions = { ...state.sessions };
    let favorites = state.favorites, recent = state.recent, changed = false;
    for (const [id, g] of Object.entries(games)) {
      if (g.playtime > (playtime[id] ?? 0)) { playtime[id] = g.playtime; changed = true; }
      if (g.sessions > (sessions[id] ?? 0)) { sessions[id] = g.sessions; changed = true; }
      if (g.favorite && !favorites.includes(id)) { favorites = [...favorites, id]; changed = true; }
      if (g.last && !recent.some((r) => r.id === id)) { recent = [...recent, { id, at: g.last }]; changed = true; }
    }
    if (changed) commit({ ...state, playtime, sessions, favorites, recent: [...recent].sort((a, b) => b.at - a.at).slice(0, 30) });
  },
  setSound(on: boolean) {
    load();
    commit({ ...state, settings: { ...state.settings, sound: on } });
  },
};

export function formatPlaytime(sec = 0) {
  if (sec < 60) return sec > 0 ? "< 1m" : "0m";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}

export function timeAgo(ts?: number) {
  if (!ts) return "Never";
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
