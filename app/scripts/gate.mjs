#!/usr/bin/env node
/**
 * Ready Gate runner (automated part, ROADMAP §7 A1–A9).
 *   npm run gate -- <game-id> [--url http://localhost:3100] [--secs 20]
 * Loads the game exactly as players get it (the hub's /play/<id>, game in its iframe) in headless Chrome on a throttled "mid-range phone"
 * (4× CPU slowdown, 10 Mbps, 40 ms RTT, 844×390 @2×, touch), measures it and writes docs/gate/<id>.json.
 * fps from headless Chrome is software-rendered on CI and only indicative; real fps is signed off by hand (B1).
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
if (!id) { console.error("usage: npm run gate -- <game-id> [--url http://localhost:3100] [--secs 20]"); process.exit(2); }
const base = opt("url", "http://localhost:3100"), secs = Number(opt("secs", 20));
const root = path.resolve(process.cwd(), process.env.GAMES_ROOT ?? "..");
const dir = ["ready", "development"].map((s) => path.join(root, s, id)).find((d) => fs.existsSync(path.join(d, "game.json")));
if (!dir) { console.error(`game "${id}" not found in ready/ or development/`); process.exit(2); }
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "game.json"), "utf8"));
const entry = manifest.entry, entryDir = path.join(dir, path.dirname(entry));
const MB = 1048576, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [];
const check = (gate, name, pass, value, limit, level = "fail") => checks.push({ gate, name, pass, value, limit, level });

// ---------- static: A2 build size / files, A9 hygiene
function weigh(d) {
  let bytes = 0, files = 0, biggest = 0; const bad = [];
  (function walk(x) {
    for (const e of fs.readdirSync(x, { withFileTypes: true })) {
      const f = path.join(x, e.name);
      if (e.name.startsWith(".") && x !== d) bad.push(path.relative(d, f));
      if (e.name.endsWith(".map")) bad.push(path.relative(d, f));
      if (e.name === "node_modules") { bad.push(path.relative(d, f)); continue; }
      if (e.isDirectory()) walk(f); else if (e.isFile()) { const n = fs.statSync(f).size; bytes += n; files++; biggest = Math.max(biggest, n); }
    }
  })(d);
  return { bytes, files, biggest, bad };
}
const rootEntry = path.relative(dir, entryDir) === "";
const w = rootEntry ? null : weigh(entryDir);
check("A9", "entry is a build output folder, not the project root", !rootEntry, rootEntry ? "project root" : path.relative(dir, entryDir), "dist folder");
if (w) {
  check("A2", "total build size", w.bytes <= 250 * MB, `${(w.bytes / MB).toFixed(1)} MB`, "≤ 250 MB");
  check("A2", "file count", w.files <= 1500, w.files, "≤ 1500");
  check("A2", "largest single file", w.biggest <= 100 * MB, `${(w.biggest / MB).toFixed(1)} MB`, "≤ 100 MB");
  check("A9", "no dotfiles / source maps / node_modules in build", w.bad.length === 0, w.bad.length ? w.bad.slice(0, 3).join(", ") : "clean", "none");
}
const html = fs.existsSync(path.join(dir, entry)) ? fs.readFileSync(path.join(dir, entry), "utf8") : "";
check("A9", "entry uses relative asset paths", !/(src|href)="\/(?!\/)/.test(html), /(src|href)="\/(?!\/)/.test(html) ? "absolute /paths" : "relative", "relative");

// ---------- dynamic
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const cdp = await page.createCDPSession();
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 40, downloadThroughput: (10 * 1e6) / 8, uploadThroughput: (5 * 1e6) / 8 });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const origin = new URL(base).origin, hosts = new Set(), errors = [];
let bytes = 0, lastNet = Date.now(), lastGameNet = 0; const urls = new Map();
const gamePath = `/g/${id}/`;   // only the game's own files count toward its download budget, not the hub shell
cdp.on("Network.requestWillBeSent", (e) => { urls.set(e.requestId, e.request.url); try { const u = new URL(e.request.url); if (u.protocol.startsWith("http") && u.origin !== origin) hosts.add(u.host); } catch {} lastNet = Date.now(); });
cdp.on("Network.loadingFinished", (e) => { if ((urls.get(e.requestId) ?? "").includes(gamePath)) { bytes += e.encodedDataLength; lastGameNet = Date.now(); } lastNet = Date.now(); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text().slice(0, 140)); });
const sdk = { hello: false, loaded: false };
await page.exposeFunction("__gateMsg", (t) => { if (t === "hello") sdk.hello = true; if (t === "loaded") sdk.loaded = true; });
await page.evaluateOnNewDocument(() => addEventListener("message", (e) => { if (e.data && e.data.hp === 1) window.__gateMsg(e.data.t); }));
// run the game inside a minimal host page so the SDK handshake has a parent to talk to
const t0 = Date.now();
await page.goto(`${base}/play/${id}`, { waitUntil: "domcontentloaded" });
// time to ready = the game frame exists, has drawn a canvas, and its own downloads have been quiet for 1.5 s
// (audio is lazy-loaded by the game afterwards and is not counted). Waiting for the frame matters: the hub shell hydrates first.
let fr0 = null;
while (Date.now() - t0 < 90000) {
  await sleep(300);
  fr0 = page.frames().find((f) => f.url().includes(gamePath)) ?? null;
  if (!fr0 || !lastGameNet) continue;
  const hasCanvas = await fr0.evaluate(() => !!document.querySelector("canvas")).catch(() => false);
  if (hasCanvas && Date.now() - lastGameNet > 1500) break;
}
const tReady = (lastGameNet - t0) / 1000, bytesReady = bytes;
await sleep(500);
const fr = page.frames().find((f) => f.url().includes(gamePath));
if (!fr) { console.error("game frame never appeared"); process.exit(1); }

check("A1", "initial download until idle", bytesReady <= 20 * MB, `${(bytesReady / MB).toFixed(1)} MB`, "≤ 20 MB (target ≤ 15)");
check("A3", "time to ready (throttled phone)", tReady <= 20, `${tReady.toFixed(1)} s`, "≤ 20 s (target ≤ 10)");
check("A3", "…meets the 10 s target", tReady <= 10, `${tReady.toFixed(1)} s`, "≤ 10 s", "warn");
check("A8", "no requests to other hosts", hosts.size === 0, hosts.size ? [...hosts].join(", ") : "none", "none");

// play: touch + keyboard noise for N seconds, sample fps/heap
const fpsS = [], heapS = [];
const t1 = Date.now();
while (Date.now() - t1 < secs * 1000) {
  await page.keyboard.down("ArrowRight"); await page.keyboard.press("KeyZ"); await page.keyboard.press("KeyX"); await page.mouse.click(300, 200);
  const m = await fr.evaluate(() => ({ fps: window.__hp?.stats?.().fps ?? 0, heap: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0 }));
  if (m.fps) fpsS.push(m.fps); if (m.heap) heapS.push(m.heap);
  await sleep(500);
}
await page.keyboard.up("ArrowRight");
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
check("A4", "no uncaught errors / console.error during run", errors.length === 0, errors.length ? errors[0] : "none", "0");
check("A5", "JS heap", Math.max(0, ...heapS) <= 512, `${Math.round(Math.max(0, ...heapS))} MB peak`, "≤ 512 MB");
const mid = heapS[Math.floor(heapS.length / 2)] ?? 0; // warm-up (first half) is not a leak: compare the second half only
check("A5", "heap growth over the second half of the run", heapS.length < 6 || heapS.at(-1) <= mid * 1.1 + 4, `${Math.round(mid)} → ${Math.round(heapS.at(-1) ?? 0)} MB`, "< +10 %", "warn");
check("A6", "SDK handshake (hello + loaded)", sdk.hello && sdk.loaded, `hello=${sdk.hello} loaded=${sdk.loaded}`, "both");
check("info", "fps (software-rendered, indicative only)", true, `avg ${Math.round(avg(fpsS))}, min ${Math.min(...fpsS, 999)}`, "signed off by hand (B1)", "info");

// lifecycle: a lost WebGL context must produce a visible, recoverable state rather than a frozen canvas
const ctxLost = await fr.evaluate(async () => {
  const c = document.querySelector("canvas"); if (!c) return "no-canvas";
  const gl = c.getContext("webgl2") || c.getContext("webgl"); const ext = gl?.getExtension("WEBGL_lose_context");
  if (!ext) return "not-webgl";
  ext.loseContext(); await new Promise((r) => setTimeout(r, 800));
  return document.getElementById("fatal") ? "overlay" : "silent";
});
check("A5", "survives forced WebGL context loss (overlay + reload)", ctxLost === "overlay" || ctxLost === "not-webgl" || ctxLost === "no-canvas", ctxLost, "overlay", ctxLost === "silent" ? "fail" : "fail");

// A7: every localStorage key the game wrote carries its prefix (shared origin with the hub and other games)
const keys = await fr.evaluate(() => Object.keys(localStorage));
const prefixes = manifest.saveKeys ?? [];
const foreign = keys.filter((k) => !k.startsWith("hp:") && !k.startsWith("hanif-play:") && !prefixes.some((p) => k.startsWith(p))); // hub-owned keys are fine
check("A7", "saves use the game's declared prefix (saveKeys)", prefixes.length > 0 && foreign.length === 0, prefixes.length ? (foreign.length ? foreign.join(", ") : `${keys.length} keys, all ${prefixes.join("|")}*`) : "no saveKeys declared", "all prefixed");

await browser.close();
const failed = checks.filter((c) => !c.pass && c.level === "fail"), warned = checks.filter((c) => !c.pass && c.level === "warn");
const report = { game: id, version: manifest.version ?? null, at: new Date().toISOString(), viewport: "844x390@2 touch, CPU×4, 10 Mbps/40 ms", passed: failed.length === 0, checks };
fs.mkdirSync("docs/gate", { recursive: true });
fs.writeFileSync(`docs/gate/${id}.json`, JSON.stringify(report, null, 2) + "\n");
for (const c of checks) console.log(`${c.pass ? "✓" : c.level === "warn" ? "!" : "✗"} ${c.gate.padEnd(4)} ${c.name.padEnd(58)} ${String(c.value).padEnd(28)} (${c.limit})`);
console.log(failed.length ? `\nGATE FAILED: ${failed.length} blocking issue(s)` : `\nGATE PASSED${warned.length ? ` with ${warned.length} warning(s)` : ""} — report: docs/gate/${id}.json`);
process.exit(failed.length ? 1 : 0);
