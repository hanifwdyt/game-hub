import "server-only";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { nextCookies } from "better-auth/next-js";
import { anonymous, username } from "better-auth/plugins";
import { db } from "./db";

/**
 * Guest-first accounts. Anyone can play as a guest (anonymous user, created lazily on first save / ~30 s of play);
 * "Create account" upgrades that same user in place, so progress is never lost.
 * Add Google / Discord later by passing `socialProviders` (needs client ids), nothing else changes.
 */
export const auth = betterAuth({
  database: db(),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
  session: { expiresIn: 60 * 60 * 24 * 90, updateAge: 60 * 60 * 24 },
  plugins: [
    anonymous({
      // the guest row is deleted after linking, so move its data to the real account first
      onLinkAccount: ({ anonymousUser, newUser }) => {
        const d = db();
        const from = anonymousUser.user.id, to = newUser.user.id;
        d.transaction(() => {
          for (const t of ["user_game", "playtime_daily", "save_slot", "save_revision", "milestone", "achievement_unlock", "user_stat"]) {
            d.prepare(`UPDATE OR IGNORE ${t} SET user_id = ? WHERE user_id = ?`).run(to, from);
            d.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(from); // rows that collided with the account's own
          }
        })();
      },
    }),
    username({ minUsernameLength: 3, maxUsernameLength: 24 }),
    nextCookies(),
  ],
});

const g = globalThis as unknown as { __authReady?: Promise<void> };
/** Better Auth creates its own tables on first run. */
export function authReady() {
  return (g.__authReady ??= getMigrations(auth.options).then((m) => m.runMigrations()));
}
