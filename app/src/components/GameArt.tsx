"use client";
import Image from "next/image";
import { useEffect, useRef } from "react";
import type { Game, ArtKind } from "@/lib/games";
import { art, DPR } from "@/lib/art/engine";

interface Props {
  game: Pick<Game, "id" | "title" | "art" | "style" | "artFocus"> & { artBlur?: Game["artBlur"] };
  kind: ArtKind;
  /** CSS size hint for next/image, e.g. "168px" or "(max-width: 760px) 80vw, 330px" */
  sizes: string;
  /** render size for the procedural fallback, in CSS px */
  w: number;
  h: number;
  /** horizontal crop for the fallback (0 = left, 1 = right) */
  focus?: number;
  priority?: boolean;
  className?: string;
}

/** Real key art when <game>/art/<kind>.* exists, otherwise deterministic procedural art. */
export function GameArt({ game, kind, sizes, w, h, focus = 0.5, priority, className }: Props) {
  const pick = game.art[kind] ? kind : kind === "tile" && game.art.cover ? "cover" : "hero";
  const url = game.art[pick];
  const blur = game.artBlur?.[pick] ?? undefined;
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (url || !ref.current) return;
    const cv = ref.current, W = Math.round(w * DPR), H = Math.round(h * DPR);
    const src = art({ id: game.id, theme: game.style.theme }, Math.round(W * 1.5), Math.round(H * 1.2));
    cv.width = W; cv.height = H;
    cv.getContext("2d")!.drawImage(src, -(src.width - W) * focus, -(src.height - H) * 0.35);
  }, [url, game.id, game.style.theme, w, h, focus]);
  if (url)
    return <Image src={url} alt="" fill sizes={sizes} priority={priority} className={className}
      placeholder={blur ? "blur" : "empty"} blurDataURL={blur}
      style={{ objectFit: "cover", objectPosition: `${Math.round(game.artFocus * 100)}% 50%` }} />;
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
