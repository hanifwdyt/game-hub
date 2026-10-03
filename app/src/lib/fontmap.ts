// game.json style.font → CSS variable registered by next/font in app/layout.tsx
const MAP: Record<string, string> = {
  "Black Ops One": "var(--f-blackops)",
  Cinzel: "var(--f-cinzel)",
  Unbounded: "var(--f-unbounded)",
  Manrope: "var(--f-ui)",
  "Press Start 2P": "var(--f-pixel)",
};
export const gameFont = (name: string) => `${MAP[name] ?? "var(--f-unbounded)"}, var(--f-ui)`;
