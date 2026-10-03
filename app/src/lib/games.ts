/**
 * Game catalogue — the single source of truth for the hub.
 *
 * Every game lives in `<GAMES_ROOT>/ready/<id>/` or `<GAMES_ROOT>/development/<id>/`
 * and describes itself with a `game.json` (see /game.schema.json).
 * Only `ready/` games appear in production; `development/` is added when HUB_INCLUDE_DEV=1.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import sharp from "sharp";

export type Platform = "pc" | "mobile";
export type Stage = "ready" | "development";
export interface Milestone { id: string; title: string; weight: number }
export interface ProgressDef {
  milestones: Milestone[];
  /** where an unmodified game keeps its own progress, so the hub can read it without game changes */
  source?: { storage: string; path?: string; kind: "array" | "keys"; prefix?: string };
}
export interface AchievementDef { id: string; name: string; desc: string; points: number; hidden: boolean; stat?: string; threshold?: number; milestone?: string }
export type MediaKind = "trailer" | "loop" | "poster";
export type ArtKind = "hero" | "cover" | "tile";

export interface Game {
  id: string;
  title: string;
  tagline: string;
  description: string;
  genres: string[];
  platforms: Platform[];
  controls: string | null;
  version: string;
  stage: Stage;
  /** false when the entry file is missing (e.g. the game still needs a build) */
  playable: boolean;
  build: string | null;
  /** path of the entry file inside the game's web root, e.g. "index.html" */
  entryFile: string;
  /** folder (relative to the game folder) that holds the entry file — the only part that is served */
  entryDir: string;
  style: { theme: string; accent: string; font: string };
  /** public URLs (served by /art/[id]/[file]) or null when the image does not exist yet */
  art: Record<ArtKind, string | null>;
  /** trailer (full, with sound), loop (6–8 s silent clip for tile focus) and poster frame; public URLs or null */
  media: Record<MediaKind, string | null>;
  /** horizontal focal point of the art, 0 = left … 1 = right (used when cropping) */
  artFocus: number;
  /** localStorage key prefixes that make up the game's save — mirrored to the player's cloud save */
  saveKeys: string[];
  progress: ProgressDef | null;
  achievements: AchievementDef[];
  /** tiny blurred data-URL per image, shown while the real one loads */
  artBlur: Record<ArtKind, string | null>;
  updatedAt: number;
}

const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;

export function gamesRoot() {
  return path.resolve(process.cwd(), process.env.GAMES_ROOT ?? "..");
}

function stages(): Stage[] {
  return process.env.HUB_INCLUDE_DEV === "1" ? ["ready", "development"] : ["ready"];
}

export function gameDir(g: Pick<Game, "id" | "stage">) {
  return path.join(gamesRoot(), g.stage, g.id);
}

/** Directory the game is served from (the folder that contains its entry file). */
export async function webRoot(g: Game) {
  return path.join(gameDir(g), g.entryDir);
}

const exists = (p: string) => fs.access(p).then(() => true, () => false);

// 16px previews, cached per file + mtime so a changed image gets a new placeholder
const blurCache = new Map<string, string>();
async function blurOf(file: string) {
  try {
    const { mtimeMs } = await fs.stat(file);
    const key = `${file}:${mtimeMs}`;
    if (!blurCache.has(key)) {
      const buf = await sharp(file).resize(16, 16, { fit: "inside" }).webp({ quality: 40 }).toBuffer();
      blurCache.set(key, `data:image/webp;base64,${buf.toString("base64")}`);
    }
    return blurCache.get(key)!;
  } catch {
    return null;
  }
}

type Manifest = Record<string, unknown>;

/** Returns a list of human-readable problems; empty means the manifest meets the standard. */
export function validateManifest(m: Manifest, folder: string): string[] {
  const errs: string[] = [];
  const str = (k: string) => typeof m[k] === "string" && (m[k] as string).trim().length > 0;
  if (!str("id") || !ID_RE.test(String(m.id))) errs.push("id must be kebab-case (a-z, 0-9, -)");
  else if (m.id !== folder) errs.push(`id "${m.id}" must match its folder "${folder}"`);
  for (const k of ["title", "tagline", "description", "entry"]) if (!str(k)) errs.push(`${k} is required`);
  if (!Array.isArray(m.genres) || m.genres.length === 0) errs.push("genres needs at least one entry");
  const plats = m.platforms;
  if (!Array.isArray(plats) || plats.length === 0 || !plats.every((p) => p === "pc" || p === "mobile"))
    errs.push('platforms must list "pc" and/or "mobile"');
  const st = m.style as Manifest | undefined;
  if (!st || typeof st !== "object") errs.push("style is required");
  else if (typeof st.accent !== "string" || !HEX_RE.test(st.accent)) errs.push("style.accent must be a #rrggbb colour");
  const entry = String(m.entry ?? "");
  if (entry.startsWith("/") || entry.includes("..")) errs.push("entry must be a relative path inside the game folder");
  return errs;
}

function parseProgress(raw: unknown): ProgressDef | null {
  const p = raw as { milestones?: unknown[]; source?: ProgressDef["source"] } | undefined;
  if (!p || !Array.isArray(p.milestones)) return null;
  const milestones = p.milestones.flatMap((x) => {
    const m = x as Partial<Milestone>;
    return m && typeof m.id === "string" && typeof m.title === "string" ? [{ id: m.id, title: m.title, weight: Number(m.weight) > 0 ? Number(m.weight) : 1 }] : [];
  });
  return milestones.length ? { milestones, source: p.source } : null;
}

function parseAchievements(raw: unknown): AchievementDef[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    const a = x as Partial<AchievementDef>;
    if (!a || typeof a.id !== "string" || typeof a.name !== "string") return [];
    const points = [5, 10, 25, 50, 100].includes(Number(a.points)) ? Number(a.points) : 10;
    return [{ id: a.id, name: a.name, desc: typeof a.desc === "string" ? a.desc : "", points, hidden: !!a.hidden,
      stat: typeof a.stat === "string" ? a.stat : undefined, threshold: typeof a.threshold === "number" ? a.threshold : undefined,
      milestone: typeof a.milestone === "string" ? a.milestone : undefined }];
  });
}

async function readGame(stage: Stage, folder: string): Promise<Game | null> {
  const dir = path.join(gamesRoot(), stage, folder);
  let m: Manifest;
  try {
    m = JSON.parse(await fs.readFile(path.join(dir, "game.json"), "utf8"));
  } catch {
    return null; // not a game folder (no or unreadable manifest)
  }
  const errs = validateManifest(m, folder);
  if (errs.length) {
    console.warn(`[hub] skipped ${stage}/${folder}: ${errs.join("; ")}`);
    return null;
  }
  const entry = String(m.entry);
  const style = m.style as { theme?: string; accent: string; font?: string };
  const artIn = (m.art ?? {}) as Partial<Record<ArtKind, string>> & { focusX?: number };
  const art = {} as Record<ArtKind, string | null>;
  const artBlur = {} as Record<ArtKind, string | null>;
  for (const kind of ["hero", "cover", "tile"] as ArtKind[]) {
    const rel = artIn[kind];
    const file = rel && !rel.includes("..") ? path.join(dir, rel) : null;
    const st = file ? await fs.stat(file).catch(() => null) : null;
    const ok = !!st?.isFile();
    // version segment = mtime, so browsers and the image optimiser never serve a stale picture
    art[kind] = ok ? `/art/${folder}/${Math.round(st!.mtimeMs).toString(36)}/${encodeURIComponent(path.basename(rel!))}` : null;
    artBlur[kind] = ok ? await blurOf(path.join(dir, rel!)) : null;
  }
  const mediaIn = (m.media ?? {}) as Partial<Record<MediaKind, string>>;
  const media = {} as Record<MediaKind, string | null>;
  for (const kind of ["trailer", "loop", "poster"] as MediaKind[]) {
    const rel = mediaIn[kind];
    const st = rel && !rel.includes("..") && !path.isAbsolute(rel) ? await fs.stat(path.join(dir, rel)).catch(() => null) : null;
    media[kind] = st?.isFile() ? `/media/${folder}/${Math.round(st.mtimeMs).toString(36)}/${encodeURIComponent(path.basename(rel!))}` : null;
  }
  const stat = await fs.stat(path.join(dir, "game.json"));
  return {
    id: folder,
    title: String(m.title),
    tagline: String(m.tagline),
    description: String(m.description),
    genres: (m.genres as unknown[]).map(String),
    platforms: m.platforms as Platform[],
    controls: typeof m.controls === "string" ? m.controls : null,
    version: typeof m.version === "string" ? m.version : "0.0.0",
    stage,
    playable: await exists(path.join(dir, entry)),
    build: typeof m.build === "string" ? m.build : null,
    entryFile: path.basename(entry),
    entryDir: path.dirname(entry),
    style: { theme: style.theme ?? "space", accent: style.accent, font: style.font ?? "" },
    art,
    artBlur,
    saveKeys: Array.isArray(m.saveKeys) ? m.saveKeys.map(String).filter(Boolean) : [],
    progress: parseProgress(m.progress),
    achievements: parseAchievements(m.achievements),
    media,
    artFocus: typeof artIn.focusX === "number" ? Math.min(1, Math.max(0, artIn.focusX)) : 0.5,
    updatedAt: stat.mtimeMs,
  };
}

// Route handlers run outside React's request cache, so keep a short-lived in-memory copy:
// asset requests (hundreds per game launch) must not rescan every folder.
const TTL_MS = process.env.NODE_ENV === "production" ? 30_000 : 2_000;
let memo: { at: number; games: Promise<Game[]> } | null = null;
export const listGames = cache(async (): Promise<Game[]> => {
  if (!memo || Date.now() - memo.at > TTL_MS) memo = { at: Date.now(), games: scanGames() };
  return memo.games;
});

async function scanGames(): Promise<Game[]> {
  const out: Game[] = [];
  for (const stage of stages()) {
    const base = path.join(gamesRoot(), stage);
    const folders = await fs.readdir(base, { withFileTypes: true }).catch(() => []);
    // symlinked folders count too, so a game can join the hub without moving its project
    const dirs = await Promise.all(folders.map(async (d) =>
      !d.name.startsWith(".") && (d.isDirectory() || (d.isSymbolicLink() && (await fs.stat(path.join(base, d.name)).then((s) => s.isDirectory(), () => false))))
        ? d.name : null));
    const found = await Promise.all(dirs.filter((n): n is string => !!n).map((n) => readGame(stage, n)));
    out.push(...found.filter((g): g is Game => g !== null));
  }
  const { only } = await hubConfig();
  const shown = only?.length ? out.filter((g) => only.includes(g.id)) : out;
  // ready before development, then most recently updated first
  return shown.sort((a, b) => (a.stage === b.stage ? b.updatedAt - a.updatedAt : a.stage === "ready" ? -1 : 1));
}

export interface ComingSoon { title: string; tagline?: string; eta?: string }
export interface HubConfig {
  /** when set, only these game ids appear in the hub (others stay on disk, just hidden) */
  only?: string[];
  /** placeholder tiles shown at the far right of the shelf */
  comingSoon?: ComingSoon[];
}

/** Hub-level curation from game-hub/hub.config.json (optional file). */
export const hubConfig = cache(async (): Promise<HubConfig> => {
  try {
    const c = JSON.parse(await fs.readFile(path.join(process.cwd(), "hub.config.json"), "utf8")) as HubConfig;
    return {
      only: Array.isArray(c.only) ? c.only.map(String) : undefined,
      comingSoon: Array.isArray(c.comingSoon) ? c.comingSoon.filter((x) => x && typeof x.title === "string") : [],
    };
  } catch {
    return { comingSoon: [] };
  }
});

export async function getGame(id: string) {
  if (!ID_RE.test(id)) return null;
  return (await listGames()).find((g) => g.id === id) ?? null;
}

/** Resolve the art file on disk for /art/[id]/[file]; null if it is not one of the game's declared images. */
export async function artPath(g: Game, file: string) {
  const raw = JSON.parse(await fs.readFile(path.join(gameDir(g), "game.json"), "utf8"));
  const declared = Object.values((raw.art ?? {}) as Record<string, unknown>)
    .find((rel): rel is string => typeof rel === "string" && path.basename(rel) === file);
  return declared ? path.join(gameDir(g), declared) : null;
}

/** Resolve a declared media file (game.json "media") for /media/[id]/[file]; null if it is not one of the game's own. */
export async function mediaPath(g: Game, file: string) {
  const raw = JSON.parse(await fs.readFile(path.join(gameDir(g), "game.json"), "utf8"));
  const declared = Object.values((raw.media ?? {}) as Record<string, unknown>)
    .find((rel): rel is string => typeof rel === "string" && path.basename(rel) === file);
  return declared ? path.join(gameDir(g), declared) : null;
}
