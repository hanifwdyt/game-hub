import path from "node:path";
import { getGame, mediaPath } from "@/lib/games";
import { serveFile } from "@/lib/serve";

// Trailer / loop / poster straight from the game's folder (declared in game.json "media"). Range requests work, so
// <video> can seek and start playing before the whole file arrives. /media/<id>/<version>/<file>: version = mtime.
export async function GET(req: Request, ctx: { params: Promise<{ id: string; file: string[] }> }) {
  const { id, file } = await ctx.params;
  const game = await getGame(id);
  const name = decodeURIComponent(file[file.length - 1] ?? "");
  const p = game && (await mediaPath(game, name));
  if (!p) return new Response("Not found", { status: 404 });
  return serveFile(path.dirname(p), path.basename(p), req, { cacheSeconds: file.length > 1 ? 31536000 : 60 });
}
