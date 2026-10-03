import { Suspense } from "react";
import { Home } from "@/components/Home";
import { hubConfig, listGames } from "@/lib/games";
import { EmptyHub } from "@/components/EmptyHub";

export const dynamic = "force-dynamic"; // re-scan game folders on every visit

export default async function Page() {
  const [games, config] = await Promise.all([listGames(), hubConfig()]);
  if (!games.length) return <EmptyHub />;
  return <Suspense><Home games={games} comingSoon={config.comingSoon ?? []} /></Suspense>;
}
