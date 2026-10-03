"use client";
import Link from "next/link";
import { useState } from "react";
import type { Game } from "@/lib/games";
import { authClient } from "@/lib/auth-client";
import { cloud, completion, useCloud } from "@/lib/cloud";
import { formatPlaytime, timeAgo, usePlayer } from "@/lib/store";
import { gameFont } from "@/lib/fontmap";
import { IconTrophy } from "./Icons";
import { toast } from "./Toast";

type G = Pick<Game, "id" | "title" | "style" | "art" | "artBlur" | "artFocus" | "progress" | "achievements" | "stage">;

export function Account({ games }: { games: G[] }) {
  const { loaded, user, games: sg } = useCloud();
  const local = usePlayer();
  if (!loaded) return <main className="acct"><div className="acct-wait"><div className="spin" /></div></main>;

  const rows = games.map((g) => {
    const s = sg[g.id];
    const pts = g.achievements.filter((a) => s?.achievements.includes(a.id)).reduce((n, a) => n + a.points, 0);
    return { g, s, pts, pct: completion(g, s?.cleared), playtime: Math.max(s?.playtime ?? 0, local.playtime[g.id] ?? 0), last: s?.last ?? local.recent.find((r) => r.id === g.id)?.at };
  });
  const totalPlay = rows.reduce((n, r) => n + r.playtime, 0), totalPts = rows.reduce((n, r) => n + r.pts, 0);
  const totalAch = rows.reduce((n, r) => n + (r.s?.achievements.length ?? 0), 0), maxAch = games.reduce((n, g) => n + g.achievements.length, 0);
  const level = Math.floor(Math.sqrt(totalPts / 10)) + 1; // simple curve: L2 at 10 pts, L3 at 40, L4 at 90 …

  return (
    <main className="acct">
      <section className="acct-hero">
        <div className="acct-avatar" aria-hidden>{(user?.name ?? "G").slice(0, 1).toUpperCase()}</div>
        <div className="acct-id">
          <div className="acct-kick">{user ? (user.isGuest ? "Guest player" : "Member") : "Not signed in"}</div>
          <h1>{user ? (user.isGuest ? "Guest" : user.name) : "Player"}</h1>
          <div className="acct-nums">
            <span><b>{formatPlaytime(totalPlay)}</b> played</span>
            <span><b>{level}</b> level</span>
            <span><IconTrophy /> <b>{totalAch}</b>/{maxAch} achievements · {totalPts} pts</span>
          </div>
        </div>
        {user && !user.isGuest && <button className="acct-btn ghost" onClick={async () => { await cloud.signOut(); toast("Signed out"); }}>Sign out</button>}
      </section>

      {(!user || user.isGuest) && <SignIn guest={!!user?.isGuest} />}

      <h2 className="acct-h">Your games</h2>
      <ul className="acct-games">
        {rows.map(({ g, s, pts, pct, playtime, last }) => (
          <li key={g.id} style={{ ["--acc" as string]: rgb(g.style.accent) }}>
            <Link href={`/play/${g.id}`} className="acct-game">
              <b data-font={g.style.font} style={{ fontFamily: gameFont(g.style.font) }}>{g.title}{g.stage === "development" && <i className="dev">DEV</i>}</b>
              <span className="acct-meta">{playtime ? formatPlaytime(playtime) : "Not played"} · {timeAgo(last)}</span>
              {pct != null && <span className="acct-bar" title={`${Math.round(pct * 100)}% complete`}><i style={{ width: `${Math.round(pct * 100)}%` }} /></span>}
              <span className="acct-meta">{pct != null ? `${Math.round(pct * 100)}% complete` : "—"}{g.achievements.length ? ` · ${s?.achievements.length ?? 0}/${g.achievements.length} achievements · ${pts} pts` : ""}</span>
            </Link>
            {g.achievements.length > 0 && (
              <ul className="acct-ach">
                {g.achievements.filter((a) => !a.hidden || s?.achievements.includes(a.id)).map((a) => {
                  const on = s?.achievements.includes(a.id);
                  return <li key={a.id} className={on ? "on" : ""} title={a.desc}><IconTrophy /><span>{a.name}</span><em>{a.points}</em></li>;
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

function SignIn({ guest }: { guest: boolean }) {
  const [mode, setMode] = useState<"up" | "in">("up");
  const [f, setF] = useState({ username: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    // signing in/up while a guest session exists links the guest's data to the account (server-side onLinkAccount)
    const r = mode === "up"
      ? await authClient.signUp.email({ email: f.email, password: f.password, name: f.username, username: f.username })
      : f.username.includes("@")
        ? await authClient.signIn.email({ email: f.username, password: f.password })
        : await authClient.signIn.username({ username: f.username, password: f.password });
    setBusy(false);
    if (r.error) return setErr(r.error.message ?? "Something went wrong");
    await cloud.refresh();
    toast(mode === "up" ? "Account created — progress saved" : "Welcome back");
  }

  return (
    <section className="acct-panel">
      <div className="acct-tabs" role="tablist">
        <button role="tab" aria-selected={mode === "up"} className={mode === "up" ? "on" : ""} onClick={() => setMode("up")}>Create account</button>
        <button role="tab" aria-selected={mode === "in"} className={mode === "in" ? "on" : ""} onClick={() => setMode("in")}>Sign in</button>
      </div>
      <p className="acct-note">{guest ? "You're playing as a guest. Create an account and everything you've done so far moves with you — to any device." : "Play without an account any time. An account just saves your progress across devices."}</p>
      <form onSubmit={submit}>
        <label>{mode === "in" ? "Username or email" : "Username"}<input value={f.username} onChange={set("username")} required minLength={mode === "up" ? 3 : 1} maxLength={mode === "up" ? 24 : 120} autoComplete="username" pattern={mode === "up" ? "[A-Za-z0-9_.]+" : undefined} /></label>
        {mode === "up" && <label>Email<input type="email" value={f.email} onChange={set("email")} required autoComplete="email" /></label>}
        <label>Password<input type="password" value={f.password} onChange={set("password")} required minLength={8} autoComplete={mode === "up" ? "new-password" : "current-password"} /></label>
        {err && <div className="acct-err" role="alert">{err}</div>}
        <button className="acct-btn" disabled={busy}>{busy ? "…" : mode === "up" ? "Create account" : "Sign in"}</button>
      </form>
    </section>
  );
}

function rgb(hex: string) { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; }
