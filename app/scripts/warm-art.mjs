#!/usr/bin/env node
// Pre-renders every game-art size the hub uses, so nobody waits on the first AVIF encode.
// Usage: npm run art:warm   (dev or prod server must be running; HUB_URL overrides http://localhost:3100)
const base = process.env.HUB_URL ?? "http://localhost:3100";
const WIDTHS = { tile: [160, 240, 320], cover: [320, 480, 640], hero: [640, 960, 1920, 2560] };
const pages = ["/", "/library"];
const urls = new Set();
for (const p of pages) {
  const html = await (await fetch(base + p)).text();
  for (const m of html.matchAll(/\/art\/[a-z0-9-]+\/[a-z0-9]+\/(hero|cover|tile)\.[a-z]+/g)) urls.add(m[0]);
}
let n = 0, t0 = Date.now();
for (const u of urls) {
  const kind = u.match(/(hero|cover|tile)\./)[1];
  for (const w of WIDTHS[kind]) {
    const r = await fetch(`${base}/_next/image?url=${encodeURIComponent(u)}&w=${w}&q=75`, { headers: { accept: "image/avif,image/webp" } });
    if (!r.ok) console.warn("✗", r.status, u, w); else n++;
    await r.arrayBuffer();
  }
}
console.log(`warmed ${n} images from ${urls.size} art files in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
