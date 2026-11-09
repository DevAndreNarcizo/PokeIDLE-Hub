#!/usr/bin/env bash
# Instalação inicial no servidor (uma vez, como root): usuário de serviço, nginx, systemd e timers.
# Pré-requisitos: Node.js 22, PostgreSQL 16, nginx, certbot e o repositório em /var/www/pokeidle-hub.
# Uso: HUB_DOMAIN=hub.seudominio.com.br deploy/install.sh
# @author André Narcizo - andre.narcizo@sysout.com.br
set -euo pipefail

: "${HUB_DOMAIN:?Defina HUB_DOMAIN (ex.: hub.seudominio.com.br)}"
APP_DIR="${APP_DIR:-/var/www/pokeidle-hub}"
SRC="$APP_DIR/deploy"

id pokeidle >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin pokeidle
install -d -o pokeidle -g pokeidle -m 750 /var/backups/pokeidle-hub /var/lib/pokeidle-hub
chmod 640 "$APP_DIR/.env" && chgrp pokeidle "$APP_DIR/.env"

echo "==> nginx"
install -m 644 "$SRC/nginx/pokeidle-hub-headers.conf" /etc/nginx/snippets/pokeidle-hub-headers.conf
sed "s/hub\.exemplo\.com\.br/$HUB_DOMAIN/g" "$SRC/nginx/pokeidle-hub.conf" > /etc/nginx/sites-available/pokeidle-hub.conf
ln -sf /etc/nginx/sites-available/pokeidle-hub.conf /etc/nginx/sites-enabled/pokeidle-hub.conf
install -d /var/www/letsencrypt
if [[ ! -f "/etc/letsencrypt/live/$HUB_DOMAIN/fullchain.pem" ]]; then
  certbot certonly --webroot -w /var/www/letsencrypt -d "$HUB_DOMAIN"
fi
nginx -t && systemctl reload nginx

echo "==> systemd"
install -m 644 "$SRC"/systemd/*.service "$SRC"/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pokeidle-hub-api.service pokeidle-hub-backup.timer pokeidle-hub-health.timer
echo "Pronto. Rode deploy/deploy.sh para publicar a versão."
