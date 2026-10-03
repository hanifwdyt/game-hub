"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconSearch, IconSound } from "./Icons";
import { player, usePlayer } from "@/lib/store";
import { openPalette } from "./CommandPalette";
import { toast } from "./Toast";
import { useCloud } from "@/lib/cloud";

export function TopBar() {
  const path = usePathname();
  const { settings } = usePlayer();
  const { user } = useCloud();
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
    tick(); const i = setInterval(tick, 10000); return () => clearInterval(i);
  }, []);
  const tab = (href: string, label: string) => {
    const on = href === "/" ? path === "/" : path.startsWith(href);
    return <Link href={href} className={`tab${on ? " on" : ""}`} aria-current={on ? "page" : undefined}>{label}</Link>;
  };
  return (
    <header className="bar">
      <nav className="tabs" aria-label="Sections">{tab("/", "Games")}{tab("/library", "Library")}</nav>
      <div className="bar-r">
        <button className="ib" aria-label="Search games" onClick={openPalette} title="Search ( / )"><IconSearch /></button>
        <button className="ib" aria-label={settings.sound ? "Mute interface sounds" : "Turn interface sounds on"}
          onClick={() => { player.setSound(!settings.sound); toast(settings.sound ? "Interface sounds off" : "Interface sounds on"); }}>
          <IconSound off={!settings.sound} />
        </button>
        <Link href="/account" className="me" aria-label={user && !user.isGuest ? `Profile: ${user.name}` : "Profile and sign in"} title={user ? (user.isGuest ? "Guest — create an account to save progress" : user.name) : "Sign in"}><span>{user && !user.isGuest ? user.name.slice(0, 1).toUpperCase() : "?"}</span>{user && !user.isGuest && <i />}</Link>
        <div className="clock" suppressHydrationWarning>{time}</div>
      </div>
    </header>
  );
}
