#!/usr/bin/env bash
# Backup diário do PostgreSQL (ARCHITECTURE.md §10): pg_dump em formato custom, verificação do
# arquivo e rotação. Lê DATABASE_URL do .env do projeto.
# Uso: deploy/backup.sh            (BACKUP_DIR e BACKUP_RETENTION_DAYS opcionais)
# @author André Narcizo - andre.narcizo@sysout.com.br
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/pokeidle-hub}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/pokeidle-hub}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | head -n1 | cut -d= -f2- | sed -e "s/^['\"]//" -e "s/['\"]$//")"
fi
[[ -n "$DATABASE_URL" ]] || { echo "DATABASE_URL não encontrada" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/pokeidle_hub-$stamp.dump"
partial="$target.partial"

# Grava em arquivo temporário e só renomeia depois de verificado: nunca sobra backup pela metade.
pg_dump --format=custom --no-owner --file="$partial" "$DATABASE_URL"
pg_restore --list "$partial" >/dev/null
mv "$partial" "$target"
chmod 600 "$target"

deleted="$(find "$BACKUP_DIR" -maxdepth 1 -name 'pokeidle_hub-*.dump' -mtime +"$RETENTION_DAYS" -print -delete | wc -l)"
echo "backup: $target ($(du -h "$target" | cut -f1)); removidos $deleted com mais de $RETENTION_DAYS dias"
