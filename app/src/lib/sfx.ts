"use client";
import { player } from "./store";

let ac: AudioContext | null = null;
if (typeof window !== "undefined") {
  const unlock = () => { try { ac ??= new AudioContext(); } catch { /* no audio */ } };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

/** Tiny synthesized UI blip; silent until the first interaction and when sound is off. */
export function blip(freq = 1200, dur = 0.07, vol = 0.03) {
  if (!ac || !player.get().settings.sound) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
  o.type = "sine";
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.62, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.03);
  o.connect(g).connect(ac.destination);
  o.start();
  o.stop(t + dur + 0.05);
}
