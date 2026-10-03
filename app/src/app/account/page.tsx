import type { Metadata } from "next";
import { Account } from "@/components/Account";
import { listGames } from "@/lib/games";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const games = (await listGames()).map(({ id, title, style, art, artBlur, artFocus, progress, achievements, stage }) =>
    ({ id, title, style, art, artBlur, artFocus, progress, achievements, stage }));
  return <Account games={games} />;
}
