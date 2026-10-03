"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Game } from "@/lib/games";
import { GameArt } from "./GameArt";
import { IconBack, IconExpand, IconHeart, IconPad, IconReload } from "./Icons";
import { formatPlaytime, player, usePlayer } from "@/lib/store";
import { gameFont } from "@/lib/fontmap";
import { cloud, completion, useCloud } from "@/lib/cloud";

const IDLE_MS = 90_000; // no input for this long = not actively playing

/** Runs a game full-screen inside the hub, records the session and owns the Guide overlay (the way out of a game). */
export function Player({ game }: { game: Game }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [nonce, setNonce] = useState(0);
  const [guide, setGuide] = useState(false);
  const sdk = useRef({ connected: false, gameplay: true, lastActivity: Date.now(), guide: false });
  const state = usePlayer();
  const { games: serverGames } = useCloud();
  const [ready, setReady] = useState(!game.saveKeys.length); // cloud save must land in localStorage before the game boots

  const post = useCallback((t: "pause" | "resume") => {
    frame.current?.contentWindow?.postMessage({ hp: 1, t }, location.origin);
  }, []);

  const setGuideOpen = useCallback((open: boolean) => {
    sdk.current.guide = open;
    setGuide(open);
    post(open ? "pause" : "resume");
    if (open) { void cloud.push(game); cloud.syncProgressFromStorage(game); }
    else frame.current?.focus();
  }, [post, game]);

  useEffect(() => {
    if (!game.saveKeys.length) return;
    let off = false;
    Promise.race([cloud.hydrate(game), new Promise((r) => setTimeout(r, 2500))]).finally(() => { if (!off) setReady(true); });
    return () => { off = true; };
  }, [game]);

  // session + playtime: counts only while the tab is visible, the Guide is closed, the game says it is in
  // gameplay and (when the SDK is present) there was input in the last 90 s
  useEffect(() => {
    player.startSession(game.id);
    sdk.current = { connected: false, gameplay: true, lastActivity: Date.now(), guide: false };
    let pending = 0;
    let total = 0, beat = 0;
    const flush = () => { if (pending > 0) { player.addPlaytime(game.id, pending); cloud.play(game.id, pending); pending = 0; } };
    void cloud.whenLoaded().then(() => cloud.play(game.id, 0, true));
    const tick = setInterval(() => {
      const s = sdk.current;
      if (document.hidden || s.guide || !s.gameplay) return;
      if (s.connected && Date.now() - s.lastActivity > IDLE_MS) return;
      pending += 1; total += 1;
      if (pending >= 15) flush();
      // ~30 s of real play: create the guest account (lazily) and upload what the browser already has
      if (total === 30) void cloud.ensureGuest().then((u) => { if (u) { flush(); void cloud.push(game); cloud.syncProgressFromStorage(game); } });
    }, 1000);
    const sync = setInterval(() => { // every 15 s read the game's own progress, every 30 s upload the save
      cloud.syncProgressFromStorage(game);
      if (++beat % 2 === 0) void cloud.push(game);
    }, 15000);
    const vis = () => { if (document.hidden) { flush(); void cloud.push(game, true); } };
    const hide = () => { flush(); void cloud.push(game, true); };
    document.addEventListener("visibilitychange", vis);
    addEventListener("pagehide", hide);
    return () => { flush(); void cloud.push(game, true); cloud.syncProgressFromStorage(game); clearInterval(tick); clearInterval(sync); document.removeEventListener("visibilitychange", vis); removeEventListener("pagehide", hide); };
  }, [game]);

  // messages from the SDK inside the game frame (only from the frame we created, same origin)
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.origin !== location.origin) return;
      const d = e.data;
      if (!d || d.hp !== 1 || typeof d.t !== "string") return;
      const s = sdk.current;
      switch (d.t) {
        case "hello": s.connected = true; s.lastActivity = Date.now(); break;
        case "loaded": setLoaded(true); break;
        case "activity": s.lastActivity = Date.now(); break;
        case "gameplay": s.gameplay = !!d.on; if (d.on) s.lastActivity = Date.now(); break;
        case "guide": setGuideOpen(!s.guide); break;
        case "progress": if (typeof d.milestone === "string") void cloud.progress(game, { milestones: [d.milestone] }); break;
        case "achievement": if (typeof d.id === "string") void cloud.progress(game, { achievements: [d.id] }); break;
        case "stat": if (typeof d.name === "string") void cloud.progress(game, { stats: { [d.name]: Number(d.n) || 1 } }); break;
      }
    };
    addEventListener("message", on);
    return () => removeEventListener("message", on);
  }, [setGuideOpen, game]);

  // the hub bar hides while playing; mouse near the top brings it back. Shift+Esc works when focus is on the hub
  // (when focus is inside the game the SDK forwards the same shortcut as a "guide" message)
  useEffect(() => {
    let t = window.setTimeout(() => setChrome(false), 2600);
    const wake = (e: PointerEvent) => { if (e.clientY < 90) { setChrome(true); clearTimeout(t); t = window.setTimeout(() => setChrome(false), 2600); } };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && e.shiftKey) { e.preventDefault(); setGuideOpen(!sdk.current.guide); } };
    addEventListener("pointermove", wake); addEventListener("keydown", key);
    return () => { clearTimeout(t); removeEventListener("pointermove", wake); removeEventListener("keydown", key); };
  }, [setGuideOpen]);

  // the iframe can finish loading before hydration attaches onLoad — check once, and never block forever
  useEffect(() => {
    const f = frame.current;
    if (f?.contentDocument?.readyState === "complete" && f.contentDocument.URL !== "about:blank") setLoaded(true);
    const t = setTimeout(() => setLoaded(true), 12000);
    return () => clearTimeout(t);
  }, [nonce]);

  const fullscreen = () => {
    if (document.fullscreenElement) return void document.exitFullscreen().catch(() => {});
    // phones: games here are landscape-only, so lock the orientation as soon as fullscreen starts (best effort)
    root.current?.requestFullscreen?.().then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape")).catch(() => {});
  };
  const restart = () => { setGuideOpen(false); setLoaded(false); setNonce((n) => n + 1); };
  const fav = state.favorites.includes(game.id);

  const items = [
    { label: "Resume", hint: "B", run: () => setGuideOpen(false) },
    { label: fav ? "Remove from favourites" : "Add to favourites", run: () => player.toggleFavorite(game.id) },
    { label: "Full screen", run: fullscreen },
    { label: "Restart game", run: restart },
    { label: "Leave to hub", danger: true, run: () => router.push("/") },
  ];

  return (
    <div className="player" ref={root}>
      {ready && <iframe key={nonce} ref={frame} src={`/g/${game.id}/${game.entryFile}`} title={game.title} onLoad={() => setLoaded(true)}
        allow="fullscreen; gamepad; autoplay; clipboard-write; xr-spatial-tracking; screen-wake-lock" />}
      <div className={`p-load${loaded ? " done" : ""}`} aria-hidden={loaded}>
        <GameArt game={game} kind="hero" sizes="100vw" w={960} h={540} priority />
        <div className="p-load-t"><h2 data-font={game.style.font} style={{ fontFamily: gameFont(game.style.font) }}>{game.title}</h2><div className="spin" /><p>Starting…</p></div>
      </div>
      <button className="p-handle" onClick={() => setGuideOpen(true)} aria-label="Open menu"><IconPad /></button>
      <div className={`p-bar${chrome ? " show" : ""}`} onPointerEnter={() => setChrome(true)}>
        <Link href="/" className="p-btn"><IconBack />Hub</Link>
        <span className="p-title">{game.title}{game.stage === "development" && <span className="dev">DEV</span>}</span>
        <span className="p-hint">Shift + Esc · gamepad Guide for menu</span>
        <button className="p-btn" onClick={() => setGuideOpen(true)} aria-label="Menu"><IconPad />Menu</button>
        <button className="p-btn" onClick={restart} aria-label="Restart game"><IconReload /></button>
        <button className="p-btn" onClick={fullscreen} aria-label="Full screen"><IconExpand /></button>
      </div>
      {guide && <Guide game={game} items={items} pct={completion(game, serverGames[game.id]?.cleared)} playtime={state.playtime[game.id] ?? 0} sessions={state.sessions[game.id] ?? 0} fav={fav} onClose={() => setGuideOpen(false)} />}
    </div>
  );
}

interface Item { label: string; hint?: string; danger?: boolean; run: () => void }

/** Console-style Guide: left rail over the paused game. Keyboard (↑↓ Enter Esc) and gamepad (D-pad, A, B) navigable. */
function Guide({ game, items, pct, playtime, sessions, fav, onClose }: { game: Game; items: Item[]; pct: number | null; playtime: number; sessions: number; fav: boolean; onClose: () => void }) {
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const selRef = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const move = useCallback((d: number) => { const n = (selRef.current + d + itemsRef.current.length) % itemsRef.current.length; selRef.current = n; setSel(n); }, []);

  useEffect(() => {
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); itemsRef.current[selRef.current].run(); }
      else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    addEventListener("keydown", key);
    // gamepad: edge-triggered D-pad / stick / A / B / Guide
    let prev = new Set<string>();
    const iv = setInterval(() => {
      const cur = new Set<string>();
      for (const g of navigator.getGamepads?.() ?? []) {
        if (!g) continue;
        if (g.buttons[12]?.pressed || g.axes[1] < -0.6) cur.add("up");
        if (g.buttons[13]?.pressed || g.axes[1] > 0.6) cur.add("down");
        if (g.buttons[0]?.pressed) cur.add("a");
        if (g.buttons[1]?.pressed || g.buttons[16]?.pressed) cur.add("b");
      }
      if (cur.has("up") && !prev.has("up")) move(-1);
      if (cur.has("down") && !prev.has("down")) move(1);
      if (cur.has("a") && !prev.has("a")) itemsRef.current[selRef.current].run();
      if (cur.has("b") && !prev.has("b")) onClose();
      prev = cur;
    }, 90);
    return () => { removeEventListener("keydown", key); clearInterval(iv); };
  }, [move, onClose]);

  return (
    <div className="guide" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="guide-rail" ref={ref} tabIndex={-1} role="menu" aria-label="Game menu" style={{ ["--acc" as string]: hexToRgb(game.style.accent) }}>
        <div className="guide-head">
          <div className="guide-kick">Paused</div>
          <h3 data-font={game.style.font} style={{ fontFamily: gameFont(game.style.font) }}>{game.title}</h3>
          <div className="guide-stats"><span>Played {formatPlaytime(playtime)}</span><span>{sessions} session{sessions === 1 ? "" : "s"}</span>{pct != null && <span>{Math.round(pct * 100)}% complete</span>}{fav && <span className="fav"><IconHeart /> Favourite</span>}</div>
        </div>
        <ul>
          {items.map((it, i) => (
            <li key={it.label}>
              <button role="menuitem" className={`${i === sel ? "on" : ""}${it.danger ? " danger" : ""}`} onPointerEnter={() => { selRef.current = i; setSel(i); }} onClick={it.run}>
                <span>{it.label}</span>{it.hint && <kbd>{it.hint}</kbd>}
              </button>
            </li>
          ))}
        </ul>
        <div className="guide-foot"><kbd>↑↓</kbd> move <kbd>Enter</kbd> select <kbd>Esc</kbd> resume</div>
      </div>
    </div>
  );
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
