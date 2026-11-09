#!/usr/bin/env bash
# Restaura um backup gerado por deploy/backup.sh. APAGA os dados atuais do banco de destino.
# Uso: deploy/restore.sh <arquivo.dump> [DATABASE_URL de destino] --yes
#      Sem URL, usa a DATABASE_URL do .env. Pare a API antes: sudo systemctl stop pokeidle-hub-api
# @author André Narcizo - andre.narcizo@sysout.com.br
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/pokeidle-hub}"
dump="${1:-}"
target="${2:-}"
confirm="${3:-${2:-}}"

[[ -f "$dump" ]] || { echo "Uso: $0 <arquivo.dump> [DATABASE_URL] --yes" >&2; exit 1; }
if [[ "$target" == "--yes" || -z "$target" ]]; then
  target="$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | head -n1 | cut -d= -f2- | sed -e "s/^['\"]//" -e "s/['\"]$//")"
fi
[[ "$confirm" == "--yes" ]] || { echo "Confirme com --yes: os dados atuais do destino serão substituídos." >&2; exit 1; }

pg_restore --list "$dump" >/dev/null
pg_restore --clean --if-exists --no-owner --single-transaction --exit-on-error --dbname="$target" "$dump"
echo "restaurado: $dump"
