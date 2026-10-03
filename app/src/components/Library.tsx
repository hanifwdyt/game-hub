"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Game, Platform } from "@/lib/games";
import { GameArt } from "./GameArt";
import { IconHeart, IconMobile, IconPc, IconSearch } from "./Icons";
import { formatPlaytime, player, usePlayer } from "@/lib/store";
import { gameFont } from "@/lib/fontmap";

type Sort = "recent" | "az" | "updated";

export function Library({ games }: { games: Game[] }) {
  const me = usePlayer();
  const [q, setQ] = useState("");
  const [plat, setPlat] = useState<Platform | "all">("all");
  const [genre, setGenre] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [favOnly, setFavOnly] = useState(false);
  const genres = useMemo(() => [...new Set(games.flatMap((g) => g.genres))].sort(), [games]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const lastAt = (id: string) => me.recent.find((r) => r.id === id)?.at ?? 0;
    return games
      .filter((g) => (plat === "all" || g.platforms.includes(plat)) && (genre === "all" || g.genres.includes(genre)))
      .filter((g) => !favOnly || me.favorites.includes(g.id))
      .filter((g) => !s || `${g.title} ${g.tagline} ${g.genres.join(" ")}`.toLowerCase().includes(s))
      .sort((a, b) => sort === "az" ? a.title.localeCompare(b.title) : sort === "updated" ? b.updatedAt - a.updatedAt : lastAt(b.id) - lastAt(a.id) || b.updatedAt - a.updatedAt);
  }, [games, q, plat, genre, sort, favOnly, me.recent, me.favorites]);

  return (
    <main className="lib">
      <div className="lib-h rise" style={{ ["--d" as string]: 1 }}>
        <h1>Library <small>{list.length} of {games.length}</small></h1>
        <label className="lib-search"><IconSearch /><input id="library-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your games" autoComplete="off" /></label>
      </div>
      <div className="filters rise" style={{ ["--d" as string]: 2 }} role="toolbar" aria-label="Filters">
        <div className="seg">{(["all", "pc", "mobile"] as const).map((p) => (
          <button key={p} aria-pressed={plat === p} onClick={() => setPlat(p)}>{p === "all" ? "All" : p === "pc" ? <><IconPc />PC</> : <><IconMobile />Mobile</>}</button>
        ))}</div>
        <div className="seg">
          <button aria-pressed={genre === "all"} onClick={() => setGenre("all")}>All genres</button>
          {genres.map((g) => <button key={g} aria-pressed={genre === g} onClick={() => setGenre(g)}>{g}</button>)}
        </div>
        <button className={`chipbtn${favOnly ? " on" : ""}`} aria-pressed={favOnly} onClick={() => setFavOnly((v) => !v)}><IconHeart />Favorites</button>
        <label className="sort">Sort
          <select id="library-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="recent">Recently played</option><option value="updated">Recently updated</option><option value="az">A–Z</option>
          </select>
        </label>
      </div>
      {list.length ? (
        <ul className="grid">
          {list.map((g, i) => {
            const fav = me.favorites.includes(g.id);
            return (
              <li key={g.id} className="cardx rise" style={{ ["--d" as string]: 3 + Math.min(i, 10) * 0.6, ["--c" as string]: g.style.accent }}>
                <Link href={g.playable ? `/play/${g.id}` : `/?g=${g.id}`} className="cover" aria-label={`${g.playable ? "Play" : "Open"} ${g.title}`}>
                  <GameArt game={g} kind="cover" sizes="(max-width: 760px) 44vw, 220px" w={220} h={293} />
                  {!g.art.cover && <span className="cover-t" style={{ fontFamily: gameFont(g.style.font) }}>{g.title}</span>}
                  {g.stage === "development" && <span className="dev corner">DEV</span>}
                  {!g.playable && <span className="needs">Needs build</span>}
                </Link>
                <div className="cardx-f">
                  <div><b>{g.title}</b><small>{g.genres.join(" · ")} · {formatPlaytime(me.playtime[g.id])}</small></div>
                  <button className={`favbtn${fav ? " on" : ""}`} aria-pressed={fav} aria-label={fav ? `Remove ${g.title} from favorites` : `Add ${g.title} to favorites`} onClick={() => player.toggleFavorite(g.id)}><IconHeart /></button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-lib">No games match these filters. <button onClick={() => { setQ(""); setPlat("all"); setGenre("all"); setFavOnly(false); }}>Clear filters</button></p>
      )}
    </main>
  );
}
