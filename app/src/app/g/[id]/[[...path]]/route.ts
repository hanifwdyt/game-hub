import { getGame, webRoot } from "@/lib/games";
import { serveFile } from "@/lib/serve";

const SDK_TAG = '<script src="/hp-sdk.js"></script>';

/** Put the Hanif Play SDK first in <head> so it can wrap AudioContext before the game creates one. */
function injectSdk(html: string) {
  if (html.includes("/hp-sdk.js")) return html;
  const m = /<head[^>]*>/i.exec(html);
  if (m) return html.slice(0, m.index + m[0].length) + SDK_TAG + html.slice(m.index + m[0].length);
  const h = /<html[^>]*>/i.exec(html);
  return h ? html.slice(0, h.index + h[0].length) + SDK_TAG + html.slice(h.index + h[0].length) : SDK_TAG + html;
}

// Serves a game's own files so it runs inside the hub at /g/<id>/<entry>.
export async function GET(req: Request, ctx: { params: Promise<{ id: string; path?: string[] }> }) {
  const { id, path = [] } = await ctx.params;
  const game = await getGame(id);
  if (!game || !game.playable) return new Response("Game not found", { status: 404 });
  let rel: string;
  try { rel = path.length ? path.map(decodeURIComponent).join("/") : game.entryFile; } catch { return new Response("Bad request", { status: 400 }); }
  return serveFile(await webRoot(game), rel, req, { transformHtml: injectSdk });
}
