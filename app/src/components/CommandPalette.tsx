"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Game } from "@/lib/games";
import { GameArt } from "./GameArt";
import { IconSearch } from "./Icons";
import { blip } from "@/lib/sfx";

type Lite = Pick<Game, "id" | "title" | "tagline" | "genres" | "platforms" | "art" | "artFocus" | "artBlur" | "style" | "stage">;
const openers = new Set<() => void>();
export const openPalette = () => openers.forEach((f) => f());

const score = (g: Lite, q: string) => {
  const hay = `${g.title} ${g.genres.join(" ")} ${g.platforms.join(" ")} ${g.tagline}`.toLowerCase();
  if (!q) return 1;
  if (g.title.toLowerCase().startsWith(q)) return 3;
  if (hay.includes(q)) return 2;
  let i = 0; for (const ch of hay) if (ch === q[i]) i++;
  return i === q.length ? 1 : 0;
};

export function CommandPalette({ games }: { games: Lite[] }) {
  const [open, setOpen] = useState(false), [q, setQ] = useState(""), [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    return games.map((g) => [g, score(g, s)] as const).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([g]) => g).slice(0, 8);
  }, [games, q]);
  useEffect(() => {
    const show = () => { setOpen(true); setQ(""); setI(0); blip(900); };
    openers.add(show);
    const key = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input,textarea,[contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) { e.preventDefault(); show(); }
    };
    addEventListener("keydown", key);
    return () => { openers.delete(show); removeEventListener("keydown", key); };
  }, []);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  if (!open) return null;
  const go = (g: Lite) => { setOpen(false); router.push(`/?g=${g.id}`); };
  return (
    <div className="pal-wrap" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="pal" role="dialog" aria-modal="true" aria-label="Search games">
        <label className="pal-in"><IconSearch />
          <input ref={input} id="palette-q" value={q} placeholder="Search games, genres, platforms…" autoComplete="off"
            onChange={(e) => { setQ(e.target.value); setI(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              else if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => Math.min(hits.length - 1, v + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => Math.max(0, v - 1)); }
              else if (e.key === "Enter" && hits[i]) go(hits[i]);
            }} />
          <kbd>esc</kbd>
        </label>
        <ul className="pal-list" role="listbox">
          {hits.map((g, k) => (
            <li key={g.id} role="option" aria-selected={k === i} className={k === i ? "on" : ""} onMouseEnter={() => setI(k)} onClick={() => go(g)}>
              <span className="pal-art"><GameArt game={g} kind="tile" sizes="44px" w={44} h={44} /></span>
              <span className="pal-t"><b>{g.title}</b><small>{g.genres.join(" · ")}</small></span>
              {g.stage === "development" && <span className="dev">DEV</span>}
            </li>
          ))}
          {!hits.length && <li className="pal-empty">No games match “{q}”. Try a genre like “strategy”.</li>}
        </ul>
      </div>
    </div>
  );
}
