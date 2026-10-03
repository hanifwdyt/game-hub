"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Game } from "@/lib/games";
import { IconBack } from "./Icons";

/** Full trailer with sound. Opens on a click (so audio is allowed), Esc / B / click outside closes. */
export function Trailer({ game, onClose }: { game: Pick<Game, "title" | "media">; onClose: () => void }) {
  const v = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    v.current?.play().catch(() => { /* controls are visible: the player can press play */ });
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } };
    addEventListener("keydown", key, true);
    let prev = false;
    const iv = setInterval(() => { // gamepad B closes
      const b = [...(navigator.getGamepads?.() ?? [])].some((g) => g?.buttons[1]?.pressed);
      if (b && !prev) onClose(); prev = b;
    }, 100);
    return () => { removeEventListener("keydown", key, true); clearInterval(iv); };
  }, [onClose]);
  if (!game.media.trailer) return null;
  // portal to <body>: ancestors with transforms would otherwise trap a position:fixed overlay
  return createPortal(
    <div className="trailer" role="dialog" aria-modal="true" aria-label={`${game.title} trailer`} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <button className="trailer-x" onClick={onClose} aria-label="Close trailer"><IconBack />Close</button>
      <video ref={v} src={game.media.trailer} poster={game.media.poster ?? undefined} controls playsInline preload="metadata" />
    </div>,
    document.body,
  );
}
