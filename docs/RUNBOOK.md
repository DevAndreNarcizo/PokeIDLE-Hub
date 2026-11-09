# Runbook — PokeIdle Hub

Operação do hub no servidor `srvsysout` (Linux), em `/var/www/pokeidle-hub`. Todos os comandos
partem da raiz do repositório, salvo indicação. Arquivos de infraestrutura ficam em `deploy/`.

## 1. Componentes

| Componente | Onde roda | Arquivo |
| --- | --- | --- |
| Painel (Angular PWA) | estáticos servidos pelo nginx | `apps/web/dist/web/browser` |
| API (Node + Express + `ws`) | serviço `pokeidle-hub-api` na porta 3000 (só localhost) | `deploy/systemd/pokeidle-hub-api.service` |
| PostgreSQL 16 | local | — |
| nginx + TLS | portas 80/443; `/api/`, `/ws`, `/bridge` vão para a API | `deploy/nginx/pokeidle-hub.conf` |
| Backup diário | timer `pokeidle-hub-backup.timer` (03:17) | `deploy/backup.sh` |
| Alarme do `/health` | timer `pokeidle-hub-health.timer` (1 min) | `deploy/healthcheck.sh` |
| Extensão (ponte) | Brave, um perfil por conta | `extension/README.md` |

## 2. Pré-requisitos do servidor

- Node.js 22 (`node -v`). O serviço usa `/usr/bin/node`; se `which node` mostrar outro caminho, ajuste `ExecStart` em `deploy/systemd/pokeidle-hub-api.service` e nos serviços de backup/alarme.
- PostgreSQL 16 com `pg_dump`/`pg_restore` da mesma versão.
- nginx (testado com 1.24) e certbot.
- Um domínio apontando para o servidor (ex.: `hub.seudominio.com.br`). O Web Push e o service worker exigem HTTPS.

## 3. Primeira instalação

```bash
sudo git clone https://github.com/DevAndreNarcizo/PokeIDLE-Hub.git /var/www/pokeidle-hub
cd /var/www/pokeidle-hub
```

Banco (troque a senha):

```bash
sudo -u postgres psql -c "CREATE ROLE pokeidle_hub LOGIN PASSWORD 'troque-esta-senha';"
sudo -u postgres createdb -O pokeidle_hub pokeidle_hub
```

Configuração (`.env`, nunca versionado):

```bash
cp .env.example .env
npm ci
npm run hash-password -w @pokeidle-hub/api      # digite a senha do painel; cole em HUB_ADMIN_PASSWORD_HASH entre aspas simples
openssl rand -base64 48                         # cole em HUB_JWT_SECRET
npm run vapid-keys -w @pokeidle-hub/api         # cole VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY
```

No `.env` de produção ajuste também:

```
NODE_ENV=production
CORS_ORIGIN=https://hub.seudominio.com.br
API_PUBLIC_PREFIX=/api
DATABASE_URL=postgresql://pokeidle_hub:<senha>@localhost:5432/pokeidle_hub
```

Build, migrações e instalação dos serviços:

```bash
npm run build
npm run db:deploy -w @pokeidle-hub/api
sudo HUB_DOMAIN=hub.seudominio.com.br deploy/install.sh
```

`install.sh` cria o usuário `pokeidle`, instala o site do nginx (emite o certificado com certbot se
ainda não houver), os serviços e timers do systemd, e sobe tudo.

Conferência:

```bash
curl -fsS https://hub.seudominio.com.br/api/health
systemctl status pokeidle-hub-api pokeidle-hub-backup.timer pokeidle-hub-health.timer
```

## 4. Publicar uma nova versão

```bash
cd /var/www/pokeidle-hub && deploy/deploy.sh            # origin/main
deploy/deploy.sh origin/feat/minha-branch               # outra ref
```

O script baixa o código, roda `npm ci`, `npm run build`, as migrações e o seed (idempotente),
reinicia a API e espera o `/health` responder. O painel é atualizado pelo service worker na
próxima abertura.

## 5. Extensão (ponte) e tokens

Instalação por perfil: `extension/README.md`. Tokens:

```bash
npm run bridge-token -w @pokeidle-hub/api -- issue 1     # mostra o token uma única vez
npm run bridge-token -w @pokeidle-hub/api -- revoke 1    # invalida na hora
```

Emitir de novo invalida o token anterior da conta. Se um perfil for perdido ou o token vazar,
revogue e emita outro.

## 6. Rotação de segredos

| Segredo | Como trocar | Efeito |
| --- | --- | --- |
| Senha do painel | `npm run hash-password -w @pokeidle-hub/api`, troque `HUB_ADMIN_PASSWORD_HASH`, `sudo systemctl restart pokeidle-hub-api` | Novos logins usam a senha nova |
| Encerrar todas as sessões | `sudo -u postgres psql -d pokeidle_hub -c "UPDATE refresh_tokens SET revoked_at = now() WHERE revoked_at IS NULL"` e troque `HUB_JWT_SECRET` | Todos os aparelhos precisam entrar de novo |
| `HUB_JWT_SECRET` | `openssl rand -base64 48`, reinicie a API | Tokens de acesso antigos deixam de valer (o painel renova pelo refresh) |
| Token da ponte | §5 | Só a conta afetada |
| Chaves VAPID | `npm run vapid-keys -w @pokeidle-hub/api`, reinicie, apague `push_subscriptions` | Cada aparelho precisa ativar os alertas de novo |
| Senha do PostgreSQL | `ALTER ROLE pokeidle_hub PASSWORD '...'`, atualize `DATABASE_URL`, reinicie | — |

## 7. Backup e restauração

- Automático: todo dia às 03:17 em `/var/backups/pokeidle-hub`, mantendo 14 dias (`BACKUP_RETENTION_DAYS`).
- Manual: `sudo -u pokeidle deploy/backup.sh`.
- Restaurar (substitui os dados atuais):

```bash
sudo systemctl stop pokeidle-hub-api
deploy/restore.sh /var/backups/pokeidle-hub/pokeidle_hub-AAAAMMDDTHHMMSSZ.dump --yes
sudo systemctl start pokeidle-hub-api
```

Teste de restauração feito em 09/11/2026 (PostgreSQL 16): backup do banco de desenvolvimento,
restauração num banco novo e de novo sobre um banco com dados; contagens de `accounts`,
`snapshots`, `hunt_catalog` e `_prisma_migrations` idênticas. Recomendado repetir a cada trimestre
restaurando num banco descartável (`createdb pokeidle_hub_restore` e passe a URL como 2º argumento).

Copie os backups para fora do servidor; hoje eles ficam só no mesmo disco.

## 8. Monitoramento

- Logs da API (JSON): `journalctl -u pokeidle-hub-api -o cat -f | jq`.
- Alarme: `deploy/healthcheck.sh` roda a cada minuto. Com 2 falhas seguidas manda um push
  "PokeIdle Hub fora do ar" para os aparelhos inscritos e registra no journal
  (`journalctl -t pokeidle-hub-health`). Avisa de novo quando volta.
  O push sai direto do banco, sem a API; se o PostgreSQL também cair, sobra só o journal.
- `GET /api/health` devolve 200 com `checks.database = ok`, ou 503.

## 9. Problemas comuns

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| Conta "Desatualizado" | Ponte desconectada (perfil do Brave fechado, service worker suspenso, token revogado) | Abra o perfil; nas opções da extensão o estado deve ser "Conectado". Token recusado: §5 |
| "Muitas tentativas" no login | Limite de 5 tentativas a cada 15 min por IP | Espere a janela ou ajuste `LOGIN_RATE_LIMIT_*` |
| Painel sem tempo real (aviso "Sem conexão com o hub") | WebSocket bloqueado | Confira o bloco `/ws` do nginx (Upgrade e `Host $http_host`) e `CORS_ORIGIN` igual à origem do painel |
| "Notificações não configuradas no servidor" | Falta VAPID no `.env` | §3 (vapid-keys) e reinicie |
| Push não chega no celular | Aparelho sem permissão, inscrição expirada ou PWA não instalado (iOS exige "Adicionar à Tela de Início") | Ative de novo em "Ativar alertas neste aparelho" e use "Testar" |
| Cartão mostra "Fonte: tela (limitada)" | A /hunt for PokeIdle não está no perfil, foi atualizada e mudou o formato, ou a aba do jogo foi aberta antes de instalá-la | Instale a /hunt no perfil e recarregue a aba do jogo; se persistir, a /hunt mudou: abra uma issue |
| Hunts "sem medição ainda" | A conta ainda não caçou nessa hunt com o pokemon ativo por 10 min ou mais | Normal: o hub só mostra valores medidos (S0.3) |

## 10. Desenvolvimento e testes

```bash
npm run dev            # API :3000 e painel :4200 (proxy /api e /ws)
npm test               # unitários; com TEST_DATABASE_URL roda também os de integração
npm run test:e2e       # Playwright em 2560×1080 e 390×844 (exige TEST_DATABASE_URL)
npm run lint && npm run typecheck && npm run format:check
```

`TEST_DATABASE_URL` deve apontar para um banco **descartável** e migrado
(`DATABASE_URL=<url> npx prisma migrate deploy` em `apps/api`): os testes apagam os dados dele.
