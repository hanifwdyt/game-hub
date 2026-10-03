"use client";
import { useEffect, useState } from "react";

const listeners = new Set<(m: string) => void>();
export const toast = (m: string) => listeners.forEach((f) => f(m));

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t = 0;
    const on = (m: string) => { setMsg(m); clearTimeout(t); t = window.setTimeout(() => setMsg(null), 2400); };
    listeners.add(on);
    return () => { listeners.delete(on); clearTimeout(t); };
  }, []);
  return <div className={`toast${msg ? " show" : ""}`} role="status" aria-live="polite">{msg}</div>;
}
