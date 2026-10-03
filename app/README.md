# Hanif Play — game hub

Console-style launcher for every game in `~/game`. Next.js 16 (App Router) + React 19 + TypeScript.

```bash
npm install
npm run dev            # http://localhost:3100
npm run games:check    # validate every game against the standard (manifest, build size, root-entry warnings)
npm run gate -- <id>   # Ready Gate runner: boots the game on a throttled phone, writes docs/gate/<id>.json
npm run package        # build deploy/ (hub + only the ready games' build output) — see DEPLOY.md
npm run typecheck
```

Production, accounts, roadmap: [`DEPLOY.md`](DEPLOY.md) · [`ROADMAP.md`](ROADMAP.md) · game audit: [`docs/GAME-READINESS.md`](docs/GAME-READINESS.md) · Bambu Runcing launch report: [`docs/BAMBU-READY.md`](docs/BAMBU-READY.md).

## How games get in

The hub scans two folders next to it:

| Folder | Shown when |
|---|---|
| `~/game/ready/<id>/` | always |
| `~/game/development/<id>/` | only with `HUB_INCLUDE_DEV=1` (set in `.env.local` for local work; marked **DEV**) |

A folder is a game when it has a **`game.json`** (schema: [`game.schema.json`](game.schema.json)):

```json
{
  "$schema": "../../game-hub/game.schema.json",
  "id": "my-game",                         // kebab-case, must equal the folder name
  "title": "My Game",
  "tagline": "One line, max 80 chars.",
  "description": "Two sentences, max 280 chars.",
  "genres": ["Action"],
  "platforms": ["pc", "mobile"],
  "entry": "dist/index.html",              // playable HTML, relative asset paths only
  "build": "npx vite build --base=./",     // optional: how to produce the entry
  "controls": "Keyboard & mouse",
  "version": "0.1.0",
  "style": { "theme": "desert", "accent": "#ff7a40", "font": "Black Ops One" },
  "art": { "hero": "art/hero.webp", "cover": "art/cover.webp", "tile": "art/tile.webp" },
  "media": { "trailer": "media/trailer.mp4", "loop": "media/loop.mp4", "poster": "media/poster.webp" },
  "saveKeys": ["my-game."],                // localStorage prefixes mirrored to the player's cloud save
  "progress": { "milestones": [{ "id": "ch1", "title": "Chapter 1", "weight": 1 }],
                "source": { "storage": "my-game.progress", "path": "cleared", "kind": "array", "prefix": "ch" } },
  "achievements": [{ "id": "cleared-ch1", "name": "Chapter 1 cleared", "points": 25, "milestone": "ch1" }]
}
```

- **Art** is optional. Missing images fall back to procedural art from `style.theme`
  (desert, fantasy, fantasy2, city, road, sea, temple, night, space, dungeon, blocks, cozy…).
  Real images are served from the game folder and optimised by `next/image` (AVIF/WebP).
  Sizes: hero 16:9 ≥ 1920 px, cover 3:4 ≥ 600 px, tile 1:1 ≥ 512 px.
- **Entry** must use relative asset paths. Vite games: build with `--base=./`
  (the hub builds into `.hub-dist/` so a game's own `dist/` stays untouched).
- **media** (optional): `trailer` (30–60 s, with sound, opened from the Trailer button), `loop` (6–8 s silent clip that fades in over the key art when the tile is focused) and `poster`. Served by `/media/[id]/…` with Range support.
- **saveKeys / progress / achievements** (optional) plug the game into accounts: cloud save of its localStorage, "% complete" and achievements, **without changing the game** (the hub reads the game's own save). Games that want more call the SDK (below).
- To publish a game, move its folder (or a symlink to it) from `development/` to `ready/` and run `npm run gate -- <id>`.

## Hub SDK (injected into every game)

The hub adds `/hp-sdk.js` to each game's HTML. A game can ignore it (pause/Guide/playtime still work) or call `hp.loading.done()`,
`hp.gameplay.start()/stop()`, `hp.progress.report("ch2")`, `hp.achievement.unlock(id)`, `hp.stat.increment(name, n)`,
`hp.event.track(name, props)`. All calls are no-ops when the game runs on its own (`window.hp` is undefined — guard with `?.`).
Shift+Esc or the gamepad Guide button opens the hub's Guide menu from inside any game.

## Curating the shelf — `hub.config.json`

```json
{
  "only": ["bambu-runcing"],                       // show just these ids (omit to show every game)
  "comingSoon": [{ "title": "More games are on the way", "tagline": "…", "eta": "2026" }]
}
```

`only` hides games from the hub without touching their folders. `comingSoon` adds locked tiles at the far right of the shelf.
A game can also join by symlink (e.g. `development/bambu-runcing -> ../bambu-runcing`), so a project never has to move.

## Key art

`tools/art-gen/gen.py jobs.json` generates art with fal.ai (key in `~/.config/fal/key`, spend in `tools/art-gen/spend.log`).
Use the game's own screenshots/sprites as `refs` so the style matches, then export WebP into `<game>/art/`.
The hub builds 16 px blur placeholders automatically.

## What's inside

| Route | What it does |
|---|---|
| `/` | Home: tile shelf, full-bleed world, welcome widgets or the selected game |
| `/library` | All games: search, platform/genre filters, favorites, sort |
| `/play/[id]` | Runs the game full-screen, records sessions and playtime |
| `/g/[id]/…` | Serves the game's own files (path-traversal safe) |
| `/art/[id]/[file]` | Serves declared art files for `next/image` |

Player data (recently played, playtime, sessions, favorites, sound) lives in the browser's localStorage.

Controls: ←/→ browse · Enter play · Esc back to Welcome · ⌘K or / search · gamepad D-pad + A/B.
