import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".avif": "image/avif", ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".mp4": "video/mp4", ".webm": "video/webm",
  ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".bin": "application/octet-stream", ".hdr": "application/octet-stream",
  ".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
  ".task": "application/octet-stream",
};

/** Folders / files that must never leave a game's folder, even when a game's entry sits in its project root. */
const BLOCKED_SEGMENTS = new Set(["node_modules", "game.json", "package.json", "package-lock.json", "tsconfig.json"]);
const blocked = (rel: string) =>
  rel.split(/[\\/]+/).some((s) => s.startsWith(".") && s !== "." || BLOCKED_SEGMENTS.has(s) || s.endsWith(".map"));

/** Vite/webpack style content-hashed asset, e.g. assets/index-Bx3k9Qa1.js — safe to cache forever. */
const HASHED = /(^|\/)assets\/.+-[A-Za-z0-9_]{8,}\.[a-z0-9]+$/;

export interface ServeOptions {
  /** transform an HTML file before sending (used to inject the Hanif Play SDK) */
  transformHtml?: (html: string) => string;
  /** override Cache-Control max-age (seconds); >= 1 year is sent as immutable */
  cacheSeconds?: number;
}

/**
 * Stream a file that must live inside `root`.
 * 404 for anything outside it (including via symlinks), dotfiles, source maps and project metadata.
 * Supports ETag / If-None-Match (304) and Range (206) so big games are not re-downloaded on every launch.
 */
export async function serveFile(root: string, rel: string, req?: Request, opts: ServeOptions = {}) {
  const nf = () => new Response("Not found", { status: 404 });
  if (blocked(rel)) return nf();
  let base: string;
  try { base = await fs.promises.realpath(path.resolve(root)); } catch { return nf(); }
  let file = path.resolve(base, rel);
  if (file !== base && !file.startsWith(base + path.sep)) return nf();
  let st: fs.Stats;
  try {
    file = await fs.promises.realpath(file);
    if (file !== base && !file.startsWith(base + path.sep)) return nf(); // symlink escape
    st = await fs.promises.stat(file);
    if (st.isDirectory()) {
      file = path.join(file, "index.html");
      st = await fs.promises.stat(file);
    }
  } catch {
    return nf();
  }

  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext] ?? "application/octet-stream";
  const relPosix = path.relative(base, file).split(path.sep).join("/");
  const hashed = HASHED.test(relPosix);
  const baseHeaders: Record<string, string> = {
    "content-type": type,
    "x-content-type-options": "nosniff",
    "accept-ranges": "bytes",
    "cache-control": hashed || (opts.cacheSeconds ?? 0) >= 31536000 ? "public, max-age=31536000, immutable"
      : opts.cacheSeconds ? `public, max-age=${opts.cacheSeconds}` : "no-cache",
  };

  // HTML entry: small, may be rewritten (SDK injection) — send whole, no range
  if (ext === ".html" && opts.transformHtml) {
    const html = opts.transformHtml(await fs.promises.readFile(file, "utf8"));
    const buf = Buffer.from(html, "utf8");
    const etag = `W/"${st.size.toString(36)}-${Math.round(st.mtimeMs).toString(36)}-sdk"`;
    if (req?.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { etag, ...baseHeaders } });
    return new Response(buf, { headers: { ...baseHeaders, etag, "content-length": String(buf.length) } });
  }

  const etag = `W/"${st.size.toString(36)}-${Math.round(st.mtimeMs).toString(36)}"`;
  const headers = { ...baseHeaders, etag, "last-modified": st.mtime.toUTCString() };
  if (req?.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  const range = req?.headers.get("range");
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : st.size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : st.size - 1;
    if (start < 0) start = 0;
    if (end >= st.size) end = st.size - 1;
    if (start > end || start >= st.size) return new Response(null, { status: 416, headers: { "content-range": `bytes */${st.size}` } });
    const body = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
    return new Response(body, { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${st.size}`, "content-length": String(end - start + 1) } });
  }

  const body = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
  return new Response(body, { headers: { ...headers, "content-length": String(st.size) } });
}
