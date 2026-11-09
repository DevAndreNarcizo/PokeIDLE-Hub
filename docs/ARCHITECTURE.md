# Arquitetura — PokeIdle Hub

## 1. Visão geral

```
┌────────────┐   WebSocket/HTTPS    ┌──────────────────────────────┐
│  Angular   │◄────────────────────►│           API (Node/TS)      │
│  PWA (web) │                      │  auth · ingest · hunts ·     │
└────────────┘                      │  alerts · scheduler · ws     │
                                    └───────┬───────────────┬──────┘
                                            │               │
                                     ┌──────▼─────┐   ┌─────▼──────────┐
                                     │ PostgreSQL │   │ StatusProvider │
                                     └────────────┘   │  (adapters)    │
                                                      └─────┬──────────┘
                              ┌───────────────────────────────┤
                      ┌───────▼────────┐             ┌────────▼───────┐
                      │ Extension      │             │ Manual/CSV     │
                      │ (browser→API)  │             │ (fallback)     │
                      └────────────────┘             └────────────────┘
```

Decisões da Fase 0 (09/11/2026, aprovadas pelo dono): **sem iframe** (o jogo envia `frame-ancestors 'none'`; S0.1); ponte = **extensão própria MV3, só leitura, para Brave**, uma instalação por perfil/conta (S0.2); métricas de hunt **medidas** pela extensão, nunca estimadas (S0.3).

Princípio: **o jogo é a fonte de verdade e o hub é um observador**. A API não fala com o jogo; ela recebe snapshots por um `StatusProvider`. Isso isola a maior incerteza do projeto (de onde vêm os dados) atrás de uma interface.

## 2. Decisões e justificativas

| Decisão | Justificativa |
| --- | --- |
| Monorepo npm workspaces | Compartilhar tipos e regras puras (`packages/shared`) entre api, web e extensão |
| Angular (PWA) | Domínio do dono; service worker e push atendem o celular |
| Node + TypeScript (Express + `ws`) | Domínio do dono; WebSocket simples para tempo real |
| PostgreSQL + Prisma | Snapshots em `jsonb` + colunas indexadas; migrações versionadas |
| zod nas bordas | Entrada externa (extensão, WS, env) é não confiável |
| Regras do jogo em `packages/shared` como funções puras | Testáveis sem I/O; reutilizáveis na UI |

Alternativas descartadas: polling HTTP puro (latência e custo), serviço por conta (complexidade sem ganho para 4 contas), guardar senha do jogo e logar pelo servidor (risco de segurança e de violar a regra de uma sessão por conta).

## 3. Fase 0 — Spikes (decidem o resto)

Cada spike gera `docs/spikes/S0.x.md` com método, resultado e decisão.

### S0.1 — O jogo aceita iframe?
Página local com `<iframe src="https://pokeidle.io/app">`. Verificar cabeçalhos `X-Frame-Options` e `Content-Security-Policy: frame-ancestors`. Verificar também se o login funciona dentro do iframe (cookies de terceiros) e se o PWA em HTTPS próprio consegue embutir.
- **Passou:** viewport embutido no painel.
- **Falhou:** botão "Abrir conta" abre janela dedicada (`window.open` com nome fixo por conta); painel segue só com status.

### S0.2 — De onde vem o status?
A wiki não cita API pública. Ordem de investigação:
1. Perguntar à equipe do jogo (Discord `#open-ticket`) se existe API ou WebSocket de leitura permitida.
2. Avaliar a **extensão de automação oficial** (Discord `#how-to-play`) como ponte.
3. Avaliar extensão própria (Manifest V3) que leia o estado visível da página do jogo e envie ao hub, respeitando os Termos.
4. Fallback: entrada manual/CSV.
Entregável: matriz de campos do `AccountSnapshot` × disponibilidade por fonte.

### S0.3 — De onde vêm XP/h, ouro/h, abates/h, "mata em" e risco por hunt?
O site da comunidade (`pokeidle-gg.pages.dev/#hunt`) calcula isso a partir da ficha do pokemon e do nível do treinador, mas o algoritmo não está documentado aqui. Opções: (a) reproduzir o cálculo com as fórmulas de `GAME_RULES.md` §6–§8 e o catálogo de espécies (CSV da Pokedex); (b) consumir uma fonte existente, se permitida; (c) deixar a coluna indisponível. Entregável: decisão e, se (a), modelo documentado e validado contra 3 casos conhecidos.

## 4. Contrato de dados (`packages/shared`)

```ts
/** Estado de uma conta num instante. Campos desconhecidos ficam `null`, nunca inventados. */
export interface AccountSnapshot {
  accountId: 1 | 2 | 3 | 4;
  capturedAt: string;                      // ISO 8601 UTC
  source: 'extension' | 'manual' | 'api';
  status: 'hunting' | 'center' | 'conflict' | 'offline' | 'unknown';
  trainerLevel: number | null;
  hunt: { region: string; level: number; name: string | null } | null;
  team: Array<{ species: string; level: number; hpPct: number }>; // até 5
  activePokemon: {
    species: string; level: number; types: string[];
    power: 1 | 2 | 3 | 4 | 5; quality: number;
    ivs: { hp: number; atk: number; def: number; spAtk: number; spDef: number; spd: number };
    stats: { hp: number; atk: number; def: number; spAtk: number; spDef: number; spd: number };
    shiny: boolean | null;               // null: fonte não informa
  } | null;
  session: {
    xpTrainerPerHour: number | null; xpPokemonPerHour: number | null;
    kills: number | null; captures: number | null; gold: number | null; // gold: acrescentado em 09/11/2026 (S0.3)
    shinySeen: number | null; shinyCaught: number | null;
    rareDrops: Record<string, number> | null;   // ex.: { bronzeBossToken: 1 }
  } | null;
  inventory: { bronzeBossToken: number | null; potions: number | null; revives: number | null; balls: Record<string, number> | null } | null;
  boosts: Array<{ kind: string; expiresAt: string | null; note: string | null }>;
  automations: { revive: AutoState; potions: AutoState; returnToHunt: AutoState; throwNonstop: AutoState } | null;
  daily: { battlePassDay: number | null; battlePassClaimedToday: boolean | null; topIdleVotedToday: boolean | null } | null;
  seasonalTypeOfDay: string | null;
  reader?: 'hunt_extension' | 'dom' | null; // fonte da leitura na extensão (09/11/2026)
}
export type AutoState = 'on' | 'off' | 'paused';
```

Regras de domínio (funções puras em `shared/src/domain`): `shinyHoursPerEvent`, `rareDropsPerHour`, `xpForLevel`, `pokemonMaxLevel`, `nextEvents`, `isStale`, `deriveAlerts`. Fórmulas em `GAME_RULES.md`.

## 5. API

Autenticação do painel: `POST /auth/login` (senha → JWT curto + refresh). Ponte da extensão: token estático por conta no header `Authorization: Bearer`, hash no banco, revogável.

| Método e rota | Função |
| --- | --- |
| `POST /ingest/snapshot` | Extensão envia snapshot de uma conta (valida com zod, rate limit) |
| `POST /sync` | Pede sincronização de todas as contas (publica `sync.request` na ponte) |
| `GET /accounts` | Último estado das 4 contas |
| `GET /accounts/:id/history?from&to&metric` | Série temporal |
| `GET /hunts?accountId&metric&region` | Lista de hunts calculada para o pokemon ativo |
| `GET /events` | Próximos eventos (calculados, sem estado) |
| `GET /alerts` · `POST /alerts/:id/ack` | Alertas |
| `GET /health` | Saúde |

WebSocket `/ws` (painel autenticado): servidor → cliente `account.updated`, `alert.opened`, `alert.resolved`, `sync.state`; cliente → servidor `sync.all`. Ponte: `sync.request` do servidor para a extensão; `snapshot` da extensão para o servidor. Mensagens versionadas (`v: 1`).

Implementação da ponte (F2-T5): WebSocket `/bridge`. O navegador não permite cabeçalhos no WebSocket, então a extensão autentica com a primeira mensagem `{ v: 1, type: 'hello', token }` (prazo de 5 s; falha fecha com 4003). Uma conexão por conta: a mais nova substitui a anterior (4002). Extensão → API: `hello`, `snapshot`, `ping` (a cada 20 s, mantém o service worker do MV3 ativo). API → extensão: `hello.ok`, `sync.request`, `snapshot.ack`, `error`. Painel: token expirado fecha `/ws` com 4001. Schemas em `packages/shared/src/protocol`.

Rotas adicionais da Fase 2: `GET /sync` (estado atual) e `POST /accounts/:id/snapshot` (entrada manual, `source = 'manual'`, sessão do painel).

## 6. Modelo de dados (PostgreSQL)

```sql
CREATE TABLE accounts (
  id            smallint PRIMARY KEY CHECK (id BETWEEN 1 AND 4),
  label         text NOT NULL,
  nick          text,
  bridge_token_hash text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE account_state (            -- último snapshot (1 linha por conta)
  account_id    smallint PRIMARY KEY REFERENCES accounts(id),
  payload       jsonb NOT NULL,
  captured_at   timestamptz NOT NULL,
  received_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE snapshots (                -- histórico
  id            bigserial PRIMARY KEY,
  account_id    smallint NOT NULL REFERENCES accounts(id),
  captured_at   timestamptz NOT NULL,
  status        text NOT NULL,
  xp_trainer_per_hour  numeric,
  xp_pokemon_per_hour  numeric,
  payload       jsonb NOT NULL
);
CREATE INDEX snapshots_account_time ON snapshots (account_id, captured_at DESC);

CREATE TABLE alerts (
  id            bigserial PRIMARY KEY,
  account_id    smallint REFERENCES accounts(id),
  kind          text NOT NULL,
  opened_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  acked_at      timestamptz,
  payload       jsonb
);
CREATE UNIQUE INDEX alerts_one_open ON alerts (account_id, kind) WHERE resolved_at IS NULL;

CREATE TABLE daily_tasks (
  account_id    smallint NOT NULL REFERENCES accounts(id),
  day           date NOT NULL,            -- dia de Brasília
  task          text NOT NULL,            -- 'battle_pass' | 'topidle_vote'
  done_at       timestamptz,
  PRIMARY KEY (account_id, day, task)
);

CREATE TABLE hunt_catalog (             -- preenchido conforme spike S0.3
  id            serial PRIMARY KEY,
  region        text NOT NULL,
  level         integer NOT NULL,
  species       text,
  types         text[],
  source        text NOT NULL,
  UNIQUE (region, level, species)
);

CREATE TABLE hunt_observations (       -- medições reais por hunt (decisão S0.3)
  id            bigserial PRIMARY KEY,
  account_id    smallint NOT NULL REFERENCES accounts(id),
  region        text NOT NULL,
  hunt_level    integer NOT NULL,
  hunt_name     text,
  species       text,                    -- pokemon ativo durante a medição
  pokemon_level integer,
  started_at    timestamptz NOT NULL,
  ended_at      timestamptz NOT NULL,
  kills         integer,
  xp_trainer    numeric,
  xp_pokemon    numeric,
  gold          numeric,
  captures      integer,
  source        text NOT NULL            -- 'extension' | 'manual'
);
CREATE INDEX hunt_observations_hunt ON hunt_observations (region, hunt_level, ended_at DESC);

CREATE TABLE refresh_tokens (           -- sessões do painel (F1-T5); só o hash SHA-256
  id            bigserial PRIMARY KEY,
  token_hash    text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz             -- rotação: cada refresh vale uma vez; reuso revoga todos
);
```

Retenção: job diário apaga `snapshots` com mais de N dias (padrão 30). Downsample opcional para 1 ponto por minuto após 24 h.

## 7. Fluxo de sincronização

1. Painel envia `sync.all` (ou o scheduler dispara a cada 30 s com Auto ligado).
2. API publica `sync.request` na ponte e marca `sync.state = running`.
3. Extensão responde com um `snapshot` por conta aberta; contas sem sessão ativa respondem `offline`/`conflict`.
4. API valida (zod), grava `account_state` e `snapshots`, avalia alertas, emite `account.updated`.
5. Se nenhuma resposta em 10 s por conta, a conta fica `stale` (UI mostra "desatualizado"); `sync.state = idle` com erros por conta.
Idempotência: snapshot com `capturedAt` ≤ o último gravado da conta é descartado.

## 8. Alertas (`deriveAlerts`)

| Alerta | Condição |
| --- | --- |
| `session_conflict` | `status = conflict` |
| `team_down` | todos `hpPct = 0` ou `status = center` com equipe caída |
| `no_potions_or_revives` | `returnToHunt = paused` ou estoque de poções e revives = 0 |
| `boost_expiring` | `expiresAt` em menos de 30 min |
| `daily_pending` | Passe ou voto pendente após 18:00 BRT (configurável) |
| `stale_data` | `now - receivedAt > 2 × intervalo` |

Abre uma vez por (conta, tipo); resolve quando a condição some.

## 9. Segurança

- Senha do painel com argon2/bcrypt; JWT de 15 min + refresh; cookies `HttpOnly`, `Secure`, `SameSite=Strict`.
- Tokens da ponte: gerados aleatoriamente, mostrados uma vez, guardados com hash, revogáveis; escopo só de ingestão.
- CORS restrito à origem do painel; rate limit em `/auth/login` e `/ingest/*`; validação zod; tamanho máximo de payload.
- Nenhuma credencial do jogo no sistema. Perfis de navegador separados por conta, para as sessões não se misturarem.
- Segredos só em variáveis de ambiente; `.env` fora do git.

## 9.1 Conformidade com o jogo

Hub somente leitura. Sem ações automáticas no jogo. Respeitar que o servidor limita rajadas por conta. Rever os Termos de Uso antes de publicar a extensão.

## 10. Deploy (`srvsysout`)

Implementado em `deploy/` (nginx, systemd, `deploy.sh`, `backup.sh`, `restore.sh`, `healthcheck.sh`); passo a passo em `docs/RUNBOOK.md`.

- Código em `/var/www/pokeidle-hub`.
- API como serviço (systemd ou pm2) atrás de nginx com TLS; WebSocket com `proxy_set_header Upgrade`.
- Web servida como estáticos pelo nginx (build Angular), com service worker.
- PostgreSQL local; backup diário com `pg_dump`.
- `GET /health` para monitoramento; logs estruturados em JSON.

## 11. Estratégia de testes

- **Unitários (shared):** fórmulas (shiny/h, raros/h, XP), calendário (fuso e virada), alertas.
- **API:** ingestão (válido, inválido, duplicado), autenticação, rate limit.
- **Contrato:** schemas zod compartilhados entre api e extensão.
- **E2E (Playwright):** sync manual, auto-sync, troca de aba no celular, alerta abrindo e fechando.
- **Visual:** capturas do grid 2×2 (2560×1080) e do celular (390×844).

## 12. Dívidas e riscos técnicos já identificados

- Dependência total da fonte de status (S0.2).
- Algoritmo de XP/h por hunt desconhecido (S0.3).
- Regras do jogo mudam: manter constantes isoladas e datadas; `GAME_RULES.md` registra a data da wiki usada (09/11/2026).
