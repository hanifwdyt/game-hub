#!/usr/bin/env node
// Checks every game folder against the hub standard. Usage: npm run games:check
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.cwd(), process.env.GAMES_ROOT ?? "..");
const ID = /^[a-z0-9][a-z0-9-]{1,63}$/, HEX = /^#[0-9a-f]{6}$/i;
let bad = 0;
const MB = 1024 * 1024;
/** Ready Gate v0 (static part): size + file count of what actually ships. Boot/perf checks come with the Playwright runner. */
function weigh(dir) {
  let bytes = 0, files = 0, biggest = 0;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".") && d !== dir || e.name === "node_modules") continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.isFile()) { const n = fs.statSync(f).size; bytes += n; files++; biggest = Math.max(biggest, n); }
    }
  })(dir);
  return { bytes, files, biggest };
}
for (const stage of (process.env.STAGES ?? "ready,development").split(",")) {
  const base = path.join(root, stage);
  if (!fs.existsSync(base)) continue;
  console.log(`\n${stage}/`);
  for (const d of fs.readdirSync(base, { withFileTypes: true })) {
    if (d.name.startsWith(".")) continue;
    if (!d.isDirectory() && !(d.isSymbolicLink() && fs.statSync(path.join(base, d.name), { throwIfNoEntry: false })?.isDirectory())) continue;
    const dir = path.join(base, d.name), mf = path.join(dir, "game.json"), issues = [], notes = [];
    if (!fs.existsSync(mf)) { console.log(`  ✗ ${d.name}  — no game.json`); bad++; continue; }
    let m; try { m = JSON.parse(fs.readFileSync(mf, "utf8")); } catch (e) { console.log(`  ✗ ${d.name}  — invalid JSON: ${e.message}`); bad++; continue; }
    if (m.id !== d.name || !ID.test(m.id ?? "")) issues.push("id must be kebab-case and match the folder");
    for (const k of ["title", "tagline", "description", "entry"]) if (!m[k]) issues.push(`missing ${k}`);
    if (!m.genres?.length) issues.push("missing genres");
    if (!m.platforms?.length || !m.platforms.every((p) => p === "pc" || p === "mobile")) issues.push("platforms must be pc/mobile");
    if (!HEX.test(m.style?.accent ?? "")) issues.push("style.accent must be #rrggbb");
    if (m.entry && !fs.existsSync(path.join(dir, m.entry))) issues.push(`entry not found (${m.entry})${m.build ? ` — run: ${m.build}` : ""}`);
    else if (m.entry?.endsWith(".html")) {
      const html = fs.readFileSync(path.join(dir, m.entry), "utf8");
      if (/(src|href)="\/(?!\/)/.test(html)) issues.push("entry uses absolute /paths — rebuild with relative base (vite --base=./)");
    }
    if (m.entry) {
      const entryDir = path.join(dir, path.dirname(m.entry));
      if (path.relative(dir, entryDir) === "") notes.push("entry sits in the project root (hub filters dotfiles/package.json, but build to dist/ before publishing)");
      else if (fs.existsSync(entryDir)) {
        const w = weigh(entryDir);
        const mb = (w.bytes / MB).toFixed(1);
        if (w.bytes > 250 * MB) issues.push(`build is ${mb} MB (limit 250 MB)`);
        else if (w.bytes > 50 * MB) notes.push(`build ${mb} MB (>50 MB desktop initial budget — needs lazy loading)`);
        else if (w.bytes > 20 * MB) notes.push(`build ${mb} MB (>20 MB mobile budget)`);
        if (w.files > 1500) issues.push(`${w.files} files (limit 1500)`);
        if (w.biggest > 100 * MB) issues.push(`a single file is ${(w.biggest / MB).toFixed(0)} MB (limit 100 MB)`);
      }
    }
    for (const k of ["hero", "cover", "tile"]) if (!m.art?.[k] || !fs.existsSync(path.join(dir, m.art[k]))) notes.push(`art missing: ${k}`);
    const ok = !issues.length;
    if (!ok) bad++;
    console.log(`  ${ok ? "✓" : "✗"} ${d.name}${issues.length ? "  — " + issues.join("; ") : ""}${notes.length ? `  (${notes.join("; ")})` : ""}`);
  }
}
console.log(bad ? `\n${bad} game(s) need attention.` : "\nAll games meet the standard.");
process.exit(bad ? 1 : 0);
