import type { Metadata, Viewport } from "next";
import { Black_Ops_One, Cinzel, JetBrains_Mono, Manrope, Press_Start_2P, Unbounded } from "next/font/google";
import { TopBar } from "@/components/TopBar";
import { Toaster } from "@/components/Toast";
import { CloudBoot } from "@/components/CloudBoot";
import { CommandPalette } from "@/components/CommandPalette";
import { listGames } from "@/lib/games";
import "./globals.css";

const ui = Manrope({ subsets: ["latin"], variable: "--f-ui", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--f-mono", display: "swap" });
const unbounded = Unbounded({ subsets: ["latin"], weight: ["600", "800"], variable: "--f-unbounded", display: "swap" });
const cinzel = Cinzel({ subsets: ["latin"], weight: ["700", "900"], variable: "--f-cinzel", display: "swap" });
const blackops = Black_Ops_One({ subsets: ["latin"], weight: "400", variable: "--f-blackops", display: "swap" });
const pixel = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--f-pixel", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Hanif Play", template: "%s · Hanif Play" },
  description: "Play every Hanif game in one place.",
  applicationName: "Hanif Play",
};
export const viewport: Viewport = { themeColor: "#05060a", viewportFit: "cover", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const games = await listGames();
  const lite = games.map(({ id, title, tagline, genres, platforms, art, artFocus, artBlur, style, stage }) => ({ id, title, tagline, genres, platforms, art, artFocus, artBlur, style, stage }));
  return (
    <html lang="en" suppressHydrationWarning className={`${ui.variable} ${mono.variable} ${unbounded.variable} ${cinzel.variable} ${blackops.variable} ${pixel.variable}`}>
      <body>
        <div className="ui">
          <TopBar />
          {children}
          <footer className="foot"><a href="/privacy">Privacy</a><a href="/credits">Credits</a></footer>
        </div>
        <CommandPalette games={lite} />
        <Toaster />
        <CloudBoot />
      </body>
    </html>
  );
}
