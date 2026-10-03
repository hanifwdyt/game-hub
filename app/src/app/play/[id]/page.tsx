import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Player } from "@/components/Player";
import { getGame } from "@/lib/games";

type P = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const g = await getGame((await params).id);
  return { title: g?.title ?? "Game not found" };
}

export default async function Page({ params }: P) {
  const game = await getGame((await params).id);
  if (!game) notFound();
  if (!game.playable) redirect(`/?g=${game.id}`);
  return <Player game={game} />;
}
