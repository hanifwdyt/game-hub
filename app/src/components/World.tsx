"use client";
/**
 * Full-bleed game world behind the home screen.
 * Two stacked canvases; a new world "blooms" out of the selected tile.
 * Uses the game's hero image when it exists, procedural parallax layers otherwise.
 */
import { useEffect, useRef } from "react";
import type { Game } from "@/lib/games";
import { LAYERS, paint, mk, glow, REDUCED } from "@/lib/art/engine";

type WorldGame = Pick<Game, "id" | "style" | "art" | "artFocus"> & { media?: Game["media"] };
interface Props { game: WorldGame | null; origin: { x: number; y: number } | null }

type Scene = { layers?: Record<string, HTMLCanvasElement>; img?: HTMLImageElement; at?: number };
type Stage = { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D; g: WorldGame | null; scene: Scene | null };
type Part = { x: number; y: number; z: number; a: number };

const PARTICLE: Record<string, string> = {
  desert: "dust", steel: "dust", fantasy: "ember", fantasy2: "ember", temple: "ember", dungeon: "ember",
  city: "rain", road: "rain", signal: "rain", sea: "spark", blocks: "spark", night: "petal",
};
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export function World({ game, origin }: Props) {
  const a = useRef<HTMLCanvasElement>(null), b = useRef<HTMLCanvasElement>(null);
  const api = useRef<{ show: (g: WorldGame, o: { x: number; y: number } | null) => void } | null>(null);

  useEffect(() => {
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const stages: Stage[] = [a.current!, b.current!].map((cv) => ({ cv, ctx: cv.getContext("2d")!, g: null, scene: null }));
    const cache = new Map<string, Scene>();
    let front = 0, revealing = false, VW = 0, VH = 0, M = 0, raf = 0, last = performance.now();
    let mx = 0, my = 0, tx = 0, ty = 0, parts: Part[] = [], ptype = "dust", pcol = [255, 255, 255], revealT = 0;

    const size = () => {
      VW = innerWidth; VH = innerHeight; M = Math.round(VW * 0.04); cache.clear();
      for (const s of stages) { s.cv.width = VW * DPR | 0; s.cv.height = VH * DPR | 0; if (s.g) s.scene = sceneFor(s.g); }
    };
    const sceneFor = (g: WorldGame): Scene => {
      const k = g.id + (g.art.hero ?? "");
      if (cache.has(k)) return cache.get(k)!;
      let sc: Scene;
      if (g.art.hero) {
        const img = new Image(); img.decoding = "async";
        sc = { img };
        img.onload = () => { sc.at = performance.now(); };
        img.src = `/_next/image?url=${encodeURIComponent(g.art.hero)}&w=${VW * DPR > 1920 ? 2560 : 1920}&q=75`;
      } else {
        const W = (VW + M * 2) * DPR | 0, H = VH * DPR | 0, layers: Record<string, HTMLCanvasElement> = {};
        for (const n of LAYERS) { const cv = mk(W, H); paint({ id: g.id, theme: g.style.theme }, n, cv.getContext("2d")!, W, H, 0); layers[n] = cv; }
        sc = { layers };
      }
      cache.set(k, sc);
      if (cache.size > 4) cache.delete(cache.keys().next().value!);
      return sc;
    };
    const seed = (g: WorldGame) => {
      ptype = PARTICLE[g.style.theme] ?? "dust"; pcol = hexRgb(g.style.accent);
      const n = ptype === "rain" ? 150 : 70, W = VW * DPR, H = VH * DPR;
      parts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 0.7, a: Math.random() * 6.28 }));
    };
    const draw = (s: Stage, t: number) => {
      const focus = s.g?.artFocus ?? 0.5;
      const c = s.ctx, sc = s.scene, W = s.cv.width, H = s.cv.height;
      c.clearRect(0, 0, W, H);
      if (!sc) return;
      const drift = Math.sin(t * 0.00007) * 0.35, m = M * DPR;
      if (sc.layers) {
        ([["sky", 0.12], ["far", 0.3], ["mid", 0.6], ["front", 1]] as const).forEach(([n, d]) =>
          c.drawImage(sc.layers![n], -m + (tx + drift) * d * m, ty * d * 8 * DPR));
      } else if (sc.img?.complete && sc.img.naturalWidth && sc.at) {
        // cover-fit with a slow breathing zoom; focus works like CSS object-position
        const im = sc.img, k = Math.max(W / im.naturalWidth, H / im.naturalHeight) * (1.035 + Math.sin(t * 0.00005) * 0.012);
        const w = im.naturalWidth * k, h = im.naturalHeight * k;
        c.globalAlpha = Math.min(1, (t - sc.at) / 700);
        c.drawImage(im, (W - w) * focus - tx * m * 0.35, (H - h) * 0.5 - ty * 6 * DPR, w, h);
        c.globalAlpha = 1;
      }
    };
    const particles = (c: CanvasRenderingContext2D, dt: number) => {
      const W = VW * DPR, H = VH * DPR, s = DPR;
      for (const p of parts) {
        const z = p.z;
        if (ptype === "dust") { p.x += (30 + z * 70) * dt * s; p.y += Math.sin((p.a += dt)) * 6 * dt * s; c.fillStyle = `rgba(255,196,150,${0.12 + z * 0.3})`; c.beginPath(); c.arc(p.x, p.y, z * 2.4 * s, 0, 7); c.fill(); }
        else if (ptype === "ember") { p.y -= (18 + z * 44) * dt * s; p.x += Math.sin((p.a += dt * 2)) * 18 * dt * s; c.globalCompositeOperation = "lighter"; glow(c, p.x, p.y, 7 * z * s, pcol, 0.75); c.globalCompositeOperation = "source-over"; }
        else if (ptype === "rain") { p.x -= 110 * dt * s * z; p.y += (720 + z * 520) * dt * s; c.strokeStyle = `rgba(170,205,255,${0.1 + z * 0.22})`; c.lineWidth = s; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 4 * s, p.y - 20 * z * s); c.stroke(); }
        else if (ptype === "petal") { p.x += (20 + z * 50) * dt * s; p.y += (30 + z * 40) * dt * s; p.a += dt * 2; c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = `rgba(255,160,200,${0.35 + z * 0.5})`; c.beginPath(); c.ellipse(0, 0, 4 * z * s, 2 * z * s, 0, 0, 7); c.fill(); c.restore(); }
        else { p.a += dt * (2 + z * 3); const al = Math.max(0, Math.sin(p.a)); c.fillStyle = `rgba(255,248,220,${al * z})`; c.fillRect(p.x - 3 * s * al, p.y - 0.5 * s, 6 * s * al, s); c.fillRect(p.x - 0.5 * s, p.y - 3 * s * al, s, 6 * s * al); }
        if (p.x > W + 20) p.x = -10; if (p.x < -20) p.x = W + 10; if (p.y > H + 20) p.y = -10; if (p.y < -20) p.y = H + 10;
      }
    };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      tx += (mx - tx) * 0.045; ty += (my - ty) * 0.045;
      const f = stages[front];
      draw(f, now);
      if (revealing) draw(stages[front ^ 1], now);
      if (f.scene && !REDUCED && !document.hidden) particles(f.ctx, dt);
      raf = requestAnimationFrame(frame);
    };
    api.current = {
      show(g, o) {
        const out = stages[front], inc = stages[front ^ 1];
        if (out.g?.id === g.id) return;
        inc.g = g; inc.scene = sceneFor(g); seed(g);
        inc.cv.style.setProperty("--ox", `${o?.x ?? VW * 0.3}px`);
        inc.cv.style.setProperty("--oy", `${o?.y ?? VH * 0.2}px`);
        inc.cv.classList.remove("reveal"); void inc.cv.offsetWidth;
        inc.cv.classList.add("front", "reveal"); out.cv.classList.remove("front");
        revealing = true; front ^= 1;
        clearTimeout(revealT); revealT = window.setTimeout(() => { revealing = false; }, 1300);
      },
    };
    const move = (e: PointerEvent) => { if (e.pointerType === "mouse") { mx = (e.clientX / innerWidth - 0.5) * 2; my = (e.clientY / innerHeight - 0.5) * 2; } };
    let rz = 0;
    const resize = () => { clearTimeout(rz); rz = window.setTimeout(size, 200); };
    size();
    addEventListener("pointermove", move); addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); removeEventListener("pointermove", move); removeEventListener("resize", resize); clearTimeout(revealT); };
  }, []);

  // the key art plays: a short silent loop fades in over it once the tile has been focused for a moment
  const vid = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = vid.current; if (!v) return;
    v.classList.remove("on"); v.pause();
    const src = game?.media?.loop;
    const saver = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!src || REDUCED || saver) return;
    const t = setTimeout(() => { if (v.getAttribute("src") !== src) v.src = src; v.currentTime = 0; v.play().catch(() => {}); }, 1000);
    const show = () => v.classList.add("on");
    v.addEventListener("playing", show);
    const vis = () => { if (document.hidden) v.pause(); else if (v.classList.contains("on")) v.play().catch(() => {}); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearTimeout(t); v.removeEventListener("playing", show); document.removeEventListener("visibilitychange", vis); };
  }, [game]);

  useEffect(() => {
    if (game) api.current?.show(game, origin);
    if (game) document.documentElement.style.setProperty("--acc", hexRgb(game.style.accent).join(","));
  }, [game, origin]);

  return (
    <>
      <canvas ref={a} className="bg" aria-hidden="true" />
      <canvas ref={b} className="bg" aria-hidden="true" />
      <video ref={vid} className="bg-video" muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />
      <div className="scrim" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
    </>
  );
}
