#!/bin/bash
# One-command release of the hub + ready games to https://game.hanif.app  (Coolify app "game-hub").
#   npm run release            # package -> commit/push deploy/ -> Coolify deploy -> smoke test
# Needs ~/.config/deploy.env (Coolify token etc.) and `gh` logged in. Safe to re-run; without changes it just redeploys.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source ~/.config/deploy.env; set +a
APP_UUID=q0c0o4gwkg0kw0go0k48ogsc            # Coolify application "game-hub" (project "game")
HOST=game.hanif.app
H="Authorization: Bearer $COOLIFY_TOKEN"

echo "1/5 checks";  npm run -s typecheck && STAGES=ready npm run -s games:check   # only what ships has to pass
echo "2/5 package"; npm run -s package
echo "3/5 push"
cd deploy
git add -A
if git diff --cached --quiet; then echo "  (no changes to push)"; else
  git commit -q -m "release: $(date +%F\ %H:%M)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"; git push -q origin main; fi
cd ..
echo "4/5 deploy"
D=$(curl -s -H "$H" "$COOLIFY_API_URL/deploy?uuid=$APP_UUID&force=true" | jq -r '.deployments[0].deployment_uuid')
for i in $(seq 1 60); do sleep 10; S=$(curl -s -H "$H" "$COOLIFY_API_URL/deployments/$D" | jq -r '.status'); echo "  [$i] $S"; case "$S" in finished) break;; failed|cancelled*) echo "DEPLOY $S"; curl -s -H "$H" "$COOLIFY_API_URL/deployments/$D" | jq -r '.logs' | jq -r '.[]?.output' | tail -30; exit 1;; esac; done
echo "5/5 smoke test"
IP=$(dig +short $HOST @1.1.1.1 | tail -1); RES=(--resolve "$HOST:443:$IP")   # public DNS, so a stale local resolver cannot fake a failure
for i in $(seq 1 20); do [ "$(curl -s "${RES[@]}" -o /dev/null -m 10 -w '%{http_code}' https://$HOST/)" = 200 ] && break; sleep 5; done
ok=1; chk() { code=$(curl -s "${RES[@]}" -o /dev/null -m 15 -w '%{http_code}' "https://$HOST/$1"); if [ "$code" = "$2" ]; then echo "  ok   $1 -> $code"; else echo "  FAIL $1 -> $code (want $2)"; ok=0; fi; }
chk "" 200; chk library 200; chk play/bambu-runcing 200; chk g/bambu-runcing/index.html 200; chk api/auth/ok 200
chk g/bambu-runcing/game.json 404; chk g/bambu-runcing/.git/config 404
[ $ok = 1 ] && echo "RELEASED https://$HOST" || { echo "SMOKE TEST FAILED"; exit 1; }
