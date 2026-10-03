"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComingSoon, Game } from "@/lib/games";
import { World } from "./World";
import { GameArt } from "./GameArt";
import { IconClock, IconGrid, IconHeart, IconMobile, IconNews, IconPad, IconPc, IconPlay, IconSpark, IconTrophy } from "./Icons";
import { formatPlaytime, player, timeAgo, usePlayer } from "@/lib/store";
import { gameFont } from "@/lib/fontmap";
import { blip } from "@/lib/sfx";
import { toast } from "./Toast";
import { Trailer } from "./Trailer";
import { completion, useCloud } from "@/lib/cloud";
import news from "@/content/news.json";

type Tile = { kind: "hub" } | { kind: "game"; game: Game } | { kind: "library" } | { kind: "soon"; item: ComingSoon; n: number };

export function Home({ games, comingSoon = [] }: { games: Game[]; comingSoon?: ComingSoon[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const me = usePlayer();
  const tiles: Tile[] = useMemo(() => [
    { kind: "hub" },
    ...games.map((g) => ({ kind: "game" as const, game: g })),
    { kind: "library" },
    ...comingSoon.map((item, n) => ({ kind: "soon" as const, item, n })), // always the far right
  ], [games, comingSoon]);
  const initial = Math.max(0, tiles.findIndex((t) => t.kind === "game" && t.game.id === params.get("g")));
  const [sel, setSel] = useState(initial);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [world, setWorld] = useState<Game | null>(null);
  const rail = useRef<HTMLDivElement>(null);

  const lastPlayed = useMemo(() => games.find((g) => g.id === me.recent[0]?.id) ?? null, [games, me.recent]);
  const current = tiles[sel];
  const focusGame = current?.kind === "game" ? current.game : null;

  // keep the world in sync with the selection (debounced so fast scrubbing stays smooth)
  useEffect(() => {
    const el = rail.current?.children[sel] as HTMLElement | undefined;
    const t = setTimeout(() => {
      const target = focusGame ?? lastPlayed ?? games[0] ?? null;
      if (el) { const r = el.getBoundingClientRect(); setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); }
      setWorld(target);
    }, 140);
    if (el && rail.current) {
      const pad = parseFloat(getComputedStyle(rail.current).paddingLeft) || 0;
      rail.current.scrollTo({ left: Math.max(0, el.offsetLeft - pad - (sel > 0 ? 120 : 0)), behavior: "smooth" });
    }
    return () => clearTimeout(t);
  }, [sel, focusGame, lastPlayed, games]);

  const select = useCallback((i: number) => {
    setSel((cur) => {
      const n = Math.max(0, Math.min(tiles.length - 1, i));
      if (n !== cur) blip(980, 0.06, 0.03);
      return n;
    });
  }, [tiles.length]);

  const activate = useCallback((i: number) => {
    const t = tiles[i];
    if (t.kind === "library") return router.push("/library");
    if (t.kind === "soon") return toast(`${t.item.title} — coming ${t.item.eta ?? "soon"}`);
    if (t.kind === "game") {
      if (!t.game.playable) return toast(`${t.game.title} needs a build first: ${t.game.build ?? "see its README"}`);
      blip(520, 0.25, 0.05);
      router.push(`/play/${t.game.id}`);
    }
  }, [tiles, router]);

  // keyboard + gamepad
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,.pal-wrap")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); select(sel + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); select(sel - 1); }
      else if (e.key === "Enter" && (document.activeElement === document.body || document.activeElement?.closest(".rail"))) { e.preventDefault(); activate(sel); }
      else if (e.key === "Escape") select(0);
    };
    let raf = 0, lastMove = 0, prevA = false, prevB = false;
    const poll = () => {
      const gp = navigator.getGamepads?.().find(Boolean);
      if (gp) {
        const now = performance.now(), ax = gp.axes[0] ?? 0;
        const right = gp.buttons[15]?.pressed || ax > 0.6, left = gp.buttons[14]?.pressed || ax < -0.6;
        if ((right || left) && now - lastMove > 170) { lastMove = now; select(sel + (right ? 1 : -1)); }
        const A = !!gp.buttons[0]?.pressed, B = !!gp.buttons[1]?.pressed;
        if (A && !prevA) activate(sel);
        if (B && !prevB) select(0);
        prevA = A; prevB = B;
      }
      raf = requestAnimationFrame(poll);
    };
    addEventListener("keydown", key); raf = requestAnimationFrame(poll);
    return () => { removeEventListener("keydown", key); cancelAnimationFrame(raf); };
  }, [sel, select, activate]);

  return (
    <>
      <World game={world} origin={origin} />
      <section className="shelf rise" style={{ ["--d" as string]: 1 }} aria-label="Your games">
        <div className="rail" ref={rail} role="listbox" aria-orientation="horizontal" aria-label="Games"
          onWheel={(e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && rail.current) rail.current.scrollLeft += e.deltaY; }}>
          {tiles.map((t, i) => (
            <button key={t.kind === "game" ? t.game.id : t.kind === "soon" ? `soon-${t.n}` : t.kind} role="option" aria-selected={i === sel}
              aria-label={tileLabel(t)}
              className={`tile${t.kind !== "game" ? " icon" : ""}${t.kind === "soon" ? " soon" : ""}${i === sel ? " on" : ""}`}
              style={{ animationDelay: `${900 + i * 55}ms` }}
              onClick={() => (i === sel ? activate(i) : select(i))}
              onMouseEnter={() => blip(1500, 0.04, 0.012)}>
              <div className="face">
                {t.kind === "game" && <><GameArt game={t.game} kind="tile" sizes="168px" w={168} h={168} />{!t.game.art.tile && <div className="logo" style={{ fontFamily: gameFont(t.game.style.font) }}>{t.game.title}</div>}</>}
                {t.kind === "hub" && <IconSpark />}
                {t.kind === "library" && <IconGrid />}
                {t.kind === "soon" && <><IconLock /><span className="soon-t">Soon</span></>}
                <div className="sheen" />
              </div>
              {t.kind === "game" && t.game.stage === "development" && <span className="dev tile-dev">DEV</span>}
              <span className="lbl">{tileLabel(t)}</span>
            </button>
          ))}
        </div>
      </section>

      <main className="stage">
        {current?.kind === "soon" ? <SoonView key={`soon-${current.n}`} item={current.item} /> :
          focusGame ? <GameView key={focusGame.id} game={focusGame} /> : <HubView games={games} lastPlayed={lastPlayed} onPick={(id) => select(tiles.findIndex((t) => t.kind === "game" && t.game.id === id))} />}
      </main>
    </>
  );
}

const tileLabel = (t: Tile) =>
  t.kind === "game" ? t.game.title : t.kind === "hub" ? "Welcome" : t.kind === "library" ? "Game Library" : "Coming Soon";

function IconLock(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" {...p}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /><circle cx="12" cy="15.5" r="1.3" fill="currentColor" /></svg>;
}

/* ---------------------------------------------------------------- coming soon */
function SoonView({ item }: { item: ComingSoon }) {
  let ci = 0;
  const title = item.title.split(" ").map((w, wi) => (
    <span className="wd" key={wi}>{[...w].map((ch, k) => <span className="ch" key={k} style={{ ["--i" as string]: ci++ }}>{ch}</span>)}</span>
  ));
  return (
    <div className="view">
      <div className="ghead">
        <span className="soon-chip rise" style={{ ["--d" as string]: 2 }}><IconLock />Coming {item.eta ?? "soon"}</span>
        <h1 className="gtitle in soon-title">{title.flatMap((t, i) => (i ? [" ", t] : [t]))}</h1>
        {item.tagline && <p className="gtag rise" style={{ ["--d" as string]: 3 }}>{item.tagline}</p>}
        <div className="gcta rise" style={{ ["--d" as string]: 4 }}>
          <Link href="/library" className="play-btn"><IconGrid /><span>Play what’s out</span></Link>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- welcome widgets (real data only) */
function HubView({ games, lastPlayed, onPick }: { games: Game[]; lastPlayed: Game | null; onPick: (id: string) => void }) {
  const me = usePlayer();
  const pad = useGamepad();
  // only count games that are actually on this hub
  const shown = new Set(games.map((g) => g.id));
  const total = Object.entries(me.playtime).reduce((a, [id, s]) => a + (shown.has(id) ? s : 0), 0);
  const played = Object.keys(me.sessions).filter((id) => shown.has(id)).length;
  const newest = [...games].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const favs = me.favorites.map((id) => games.find((g) => g.id === id)).filter(Boolean) as Game[];
  return (
    <div className="view">
      <Link href="/library" className="pillbtn rise" style={{ ["--d" as string]: 3 }}><IconGrid />{games.length === 1 ? "Browse the library" : `Browse all ${games.length} games`}</Link>
      <div className="widgets">
        {lastPlayed ? (
          <Link href={`/play/${lastPlayed.id}`} className="w cont rise" style={{ ["--d" as string]: 4 }}>
            <GameArt game={lastPlayed} kind="hero" sizes="(max-width: 760px) 92vw, 520px" w={520} h={300} />
            <div className="cont-t"><span className="k">Continue</span><b data-font={lastPlayed.style.font} style={{ fontFamily: gameFont(lastPlayed.style.font) }}>{lastPlayed.title}</b>
              <small>{formatPlaytime(me.playtime[lastPlayed.id])} played · {timeAgo(me.recent[0]?.at)}</small></div>
            <span className="cont-play"><IconPlay />Resume</span>
          </Link>
        ) : (
          <article className="w cont empty rise" style={{ ["--d" as string]: 4 }}>
            <div className="cont-t"><span className="k">Start here</span><b>Pick a game from the shelf</b><small>Your progress and playtime show up here.</small></div>
          </article>
        )}
        <div className="col">
          <article className="w stats rise" style={{ ["--d" as string]: 5 }}>
            <div className="wh"><IconTrophy />Your stats</div>
            <div className="nums">
              <div><b>{games.length}</b><small>Games</small></div>
              <div><b>{played}</b><small>Played</small></div>
              <div><b>{formatPlaytime(total)}</b><small>Playtime</small></div>
              <div><b>{favs.length}</b><small>Favorites</small></div>
            </div>
          </article>
          <article className="w pad rise" style={{ ["--d" as string]: 6 }}>
            <div className={`ringc${pad ? " live" : ""}`}><IconPad /></div>
            <div><p>{pad ? "Controller connected" : "No controller"}</p><small>{pad ? pad.slice(0, 38) : "Plug one in and press any button — D-pad browses, A plays."}</small></div>
          </article>
        </div>
        <div className="col">
          {newest && (
            <button className="w mini rise" style={{ ["--d" as string]: 7 }} onClick={() => onPick(newest.id)}>
              <div className="wh"><IconSpark style={{ width: 20 }} />Recently updated</div>
              <p>{newest.title}</p><small>v{newest.version} · {timeAgo(newest.updatedAt)}</small>
            </button>
          )}
          <article className="w mini rise" style={{ ["--d" as string]: 8 }}>
            <div className="wh"><IconHeart />Favorites</div>
            {favs.length ? <p>{favs.slice(0, 2).map((g) => g.title).join(" · ")}</p> : <p className="muted">None yet</p>}
            <small>{favs.length ? `${favs.length} saved` : "Tap ♥ on a game to keep it here"}</small>
          </article>
          <article className="w mini rise" style={{ ["--d" as string]: 9 }}>
            <div className="wh"><IconNews />News</div>
            <p>{news[0].title}</p><small>{news[0].date}</small>
          </article>
        </div>
      </div>
    </div>
  );
}

function useGamepad() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setName(navigator.getGamepads?.().find(Boolean)?.id ?? null);
    const on = (e: GamepadEvent) => { setName(e.gamepad.id); toast("Controller connected — D-pad browses, A plays"); };
    read(); addEventListener("gamepadconnected", on); addEventListener("gamepaddisconnected", read);
    return () => { removeEventListener("gamepadconnected", on); removeEventListener("gamepaddisconnected", read); };
  }, []);
  return name;
}

/* ---------------------------------------------------------------- selected game */
function GameView({ game }: { game: Game }) {
  const me = usePlayer();
  const { games: sg } = useCloud();
  const [trailer, setTrailer] = useState(false);
  const pct = completion(game, sg[game.id]?.cleared);
  const fav = me.favorites.includes(game.id);
  const last = me.recent.find((r) => r.id === game.id)?.at;
  let ci = 0;
  const title = game.title.split(" ").map((w, wi) => (
    <span className="wd" key={wi}>{[...w].map((ch, k) => <span className="ch" key={k} style={{ ["--i" as string]: ci++ }}>{ch}</span>)}</span>
  ));
  return (
    <div className="view">
      <div className="ghead">
        <h1 className="gtitle in" data-font={game.style.font} style={{ fontFamily: gameFont(game.style.font) }}>{title.flatMap((t, i) => (i ? [" ", t] : [t]))}</h1>
        <p className="gtag rise" style={{ ["--d" as string]: 3 }}>{game.tagline} {game.description}</p>
        <div className="gmeta rise" style={{ ["--d" as string]: 4 }}>
          {game.stage === "development" && <span className="dev">IN DEVELOPMENT</span>}
          <span className="chip">{game.genres.join(" · ")}</span>
          <span className="chip">{game.platforms.map((p) => <span key={p} className="pl">{p === "pc" ? <IconPc /> : <IconMobile />}{p === "pc" ? "PC" : "Mobile"}</span>)}</span>
          {game.controls && <span>{game.controls}</span>}
          <span>v{game.version}</span>
        </div>
        <div className="gcta rise" style={{ ["--d" as string]: 5 }}>
          {game.playable ? (
            <Link href={`/play/${game.id}`} className="play-btn" onClick={() => blip(520, 0.25, 0.05)}><IconPlay /><span>Play</span></Link>
          ) : (
            <button className="play-btn off" onClick={() => toast(`Build it first: ${game.build ?? "see README"}`)}><span>Needs build</span></button>
          )}
          <button className={`round fav${fav ? " on" : ""}`} aria-pressed={fav} aria-label={fav ? "Remove from favorites" : "Add to favorites"}
            onClick={() => toast(player.toggleFavorite(game.id) ? `${game.title} added to favorites` : `${game.title} removed from favorites`)}><IconHeart /></button>
          {game.media.trailer && <button className="trailer-btn" onClick={() => setTrailer(true)}><IconPlay /><span>Trailer</span></button>}
        </div>
        <div className="gprog rise" style={{ ["--d" as string]: 6 }}>
          <span><IconClock />{formatPlaytime(me.playtime[game.id])} played</span>
          <span>{me.sessions[game.id] ?? 0} sessions</span>
          <span>Last played: {timeAgo(last)}</span>
          {pct != null && <span><IconTrophy />{Math.round(pct * 100)}% complete</span>}
        </div>
        {trailer && <Trailer game={game} onClose={() => setTrailer(false)} />}
      </div>
      <div className="acts">
        {[
          { k: "About", t: game.tagline, s: game.genres.join(" · "), f: 0.15 },
          { k: "How to play", t: game.controls ?? "See in-game help", s: game.platforms.map((p) => (p === "pc" ? "PC" : "Mobile")).join(" · "), f: 0.5 },
          { k: "Your record", t: `${formatPlaytime(me.playtime[game.id])} · ${me.sessions[game.id] ?? 0} sessions`, s: `Last played ${timeAgo(last).toLowerCase()}`, f: 0.85 },
        ].map((c, i) => (
          <article key={c.k} className="w act rise" style={{ ["--d" as string]: 7 + i }}>
            <GameArt game={game} kind="hero" sizes="(max-width: 760px) 78vw, 330px" w={330} h={170} focus={c.f} />
            <div className="t"><span className="k">{c.k}</span><b>{c.t}</b><small>{c.s}</small></div>
          </article>
        ))}
      </div>
    </div>
  );
}
