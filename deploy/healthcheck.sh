#!/usr/bin/env bash
# Alarme do /health (ARCHITECTURE.md §10): roda a cada minuto pelo timer. Depois de
# FAILS_BEFORE_ALARM falhas seguidas, avisa por push e no journal; quando volta, avisa de novo.
# Só notifica nas mudanças de estado (sem repetir a cada minuto).
# @author André Narcizo - andre.narcizo@sysout.com.br
set -uo pipefail

APP_DIR="${APP_DIR:-/var/www/pokeidle-hub}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
STATE_FILE="${STATE_FILE:-/var/lib/pokeidle-hub/health.state}"
FAILS_BEFORE_ALARM="${FAILS_BEFORE_ALARM:-2}"
NOTIFY_CMD="${NOTIFY_CMD:-node --env-file=$APP_DIR/.env $APP_DIR/apps/api/dist/cli/notify.js}"

log() { logger -t pokeidle-hub-health -- "$*" 2>/dev/null || true; echo "$*"; }

notify() {
  # shellcheck disable=SC2086 # NOTIFY_CMD é um comando com argumentos.
  if ! $NOTIFY_CMD "$1" "$2" health >/dev/null 2>&1; then
    log "aviso: não foi possível enviar o push ($1)"
  fi
}

fails=0
state=ok
if [[ -f "$STATE_FILE" ]]; then
  read -r state fails < "$STATE_FILE" || true
fi

body="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>&1)"
code=$?

if [[ $code -eq 0 ]]; then
  if [[ "$state" == down ]]; then
    log "hub de volta: $body"
    notify "PokeIdle Hub voltou" "A API respondeu ao /health de novo."
  fi
  echo "ok 0" > "$STATE_FILE"
  exit 0
fi

fails=$((fails + 1))
if [[ "$state" == ok && $fails -ge $FAILS_BEFORE_ALARM ]]; then
  log "hub fora do ar há $fails verificações: $body"
  notify "PokeIdle Hub fora do ar" "Sem resposta do /health há $fails min. Veja journalctl -u pokeidle-hub-api."
  state=down
fi
echo "$state $fails" > "$STATE_FILE"
exit 0
