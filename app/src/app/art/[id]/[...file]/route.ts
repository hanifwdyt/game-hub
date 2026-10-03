import path from "node:path";
import { artPath, getGame } from "@/lib/games";
import { serveFile } from "@/lib/serve";

// Game key art straight from <game>/art/, consumed by next/image (see next.config.ts).
// URLs look like /art/<id>/<version>/<file>; the version is the file's mtime, so a replaced image gets a new URL.
export async function GET(req: Request, ctx: { params: Promise<{ id: string; file: string[] }> }) {
  const { id, file } = await ctx.params;
  const game = await getGame(id);
  const name = decodeURIComponent(file[file.length - 1] ?? "");
  const p = game && (await artPath(game, name));
  if (!p) return new Response("Not found", { status: 404 });
  return serveFile(path.dirname(p), path.basename(p), req, { cacheSeconds: file.length > 1 ? 31536000 : 60 });
}
