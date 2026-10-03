import type { Metadata } from "next";
import { Library } from "@/components/Library";
import { listGames } from "@/lib/games";

export const metadata: Metadata = { title: "Library" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return <Library games={await listGames()} />;
}
