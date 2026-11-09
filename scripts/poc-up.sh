#!/usr/bin/env bash
# Laptop POC: serve Echo publicly through a Cloudflare quick tunnel.
# Starts db, API, built web (vite preview) and the tunnel. Ctrl+C stops all of it.
# The tunnel URL is random and changes on every run. Needs docker and cloudflared.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS="$ROOT/.poc-logs"
cd "$ROOT"
mkdir -p "$LOGS"

command -v docker >/dev/null || { echo "docker not found (enable Docker Desktop WSL integration)"; exit 1; }
command -v cloudflared >/dev/null || { echo "cloudflared not found"; exit 1; }

pids=()
cleanup() {
  echo; echo "Stopping API, web preview and tunnel (database keeps running; 'npm run db:down' to stop it)..."
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

echo "==> Database"
npm run db:up
echo "==> Migrations (also builds the API)"
npm run migration:run -w @echo/api >"$LOGS/migrate.log" 2>&1 || { tail -20 "$LOGS/migrate.log"; exit 1; }
echo "==> Building web"
npm run build -w @echo/web >"$LOGS/web-build.log" 2>&1 || { tail -20 "$LOGS/web-build.log"; exit 1; }

echo "==> API :3000"
NODE_ENV=production npm run start:prod -w @echo/api >"$LOGS/api.log" 2>&1 &
pids+=($!)
echo "==> Web preview :5173"
npm run preview -w @echo/web -- --host 127.0.0.1 --port 5173 >"$LOGS/web.log" 2>&1 &
pids+=($!)

for _ in $(seq 1 30); do
  curl -fs -o /dev/null http://127.0.0.1:5173/volunteer-portal/ && curl -s -o /dev/null http://127.0.0.1:5173/api/me && break
  sleep 1
done

echo "==> Tunnel"
cloudflared tunnel --url http://localhost:5173 >"$LOGS/tunnel.log" 2>&1 &
pids+=($!)

url=""
for _ in $(seq 1 30); do
  url="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOGS/tunnel.log" | head -1 || true)"
  [ -n "$url" ] && break
  sleep 1
done
[ -n "$url" ] || { echo "Tunnel URL not found, see $LOGS/tunnel.log"; exit 1; }

echo
echo "Echo is up: $url/volunteer-portal/"
echo "Logs: $LOGS   |   Ctrl+C to stop"
wait
