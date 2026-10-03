import "server-only";
import { auth, authReady } from "./auth";

export interface HubUser { id: string; name: string; username: string | null; isGuest: boolean }

/** The signed-in user (guest or full account) for this request, or null. */
export async function getUser(req: Request): Promise<HubUser | null> {
  await authReady();
  const s = await auth.api.getSession({ headers: req.headers });
  if (!s) return null;
  const u = s.user as typeof s.user & { isAnonymous?: boolean; username?: string | null; displayUsername?: string | null };
  return { id: u.id, name: u.displayUsername || u.username || u.name, username: u.username ?? null, isGuest: !!u.isAnonymous };
}

/** Mutating requests must come from our own pages (cookies are SameSite=Lax, this closes the remaining gap). */
export function sameOrigin(req: Request) {
  const o = req.headers.get("origin");
  if (!o) return true; // non-browser clients (curl, tests) — the session cookie is still required
  try { return new URL(o).host === (req.headers.get("host") ?? ""); } catch { return false; }
}
