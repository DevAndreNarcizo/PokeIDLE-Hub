#!/usr/bin/env bash
# Atualiza o PokeIdle Hub no servidor: código, dependências, build, migrações e reinício da API.
# Uso (no servidor, como o usuário dono de /var/www/pokeidle-hub):
#   deploy/deploy.sh [ref]          # ref padrão: origin/main
# @author André Narcizo - andre.narcizo@sysout.com.br
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/pokeidle-hub}"
REF="${1:-origin/main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"

cd "$APP_DIR"
[[ -f .env ]] || { echo "Falta $APP_DIR/.env (copie de .env.example e preencha)." >&2; exit 1; }

echo "==> Código: $REF"
git fetch --prune origin
git checkout --detach "$REF"

echo "==> Dependências"
npm ci --no-audit --no-fund

echo "==> Build (shared, api, web, extensão)"
npm run build

echo "==> Migrações e seed"
npm run db:deploy -w @pokeidle-hub/api

echo "==> Reiniciando a API"
sudo systemctl restart pokeidle-hub-api

echo "==> Conferindo /health"
for _ in $(seq 1 20); do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    echo "OK: $(git rev-parse --short HEAD) no ar."
    exit 0
  fi
  sleep 1
done
echo "A API não respondeu em $HEALTH_URL. Veja: journalctl -u pokeidle-hub-api -n 100" >&2
exit 1
