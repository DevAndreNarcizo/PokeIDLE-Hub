# Roadmap — PokeIdle Hub

Execute as fases em ordem. Cada tarefa tem ID, entrega e critério de aceite. Um commit por tarefa. Pare ao fim da Fase 0 e reporte.

## Fase 0 — Spikes (sem código de produto)

| ID | Tarefa | Entrega | Aceite |
| --- | --- | --- | --- |
| F0-T1 | S0.1: testar iframe do jogo | `docs/spikes/S0.1.md` + página de teste descartável | Cabeçalhos do jogo registrados; decisão "embutir" ou "janela dedicada" |
| F0-T2 | S0.2: fonte de status | `docs/spikes/S0.2.md` | Matriz campo × fonte; recomendação de ponte; dúvidas para o Discord do jogo |
| F0-T3 | S0.3: origem do XP/h por hunt | `docs/spikes/S0.3.md` | Decisão entre reproduzir, consumir fonte existente ou deixar indisponível |
| F0-T4 | Registrar dúvidas | `docs/OPEN_QUESTIONS.md` | Cada dúvida com dono e impacto |

**Parada obrigatória:** reportar ao dono e aguardar a decisão antes da Fase 2.

## Fase 1 — Fundação

| ID | Tarefa | Aceite |
| --- | --- | --- |
| F1-T1 | Monorepo npm workspaces (`apps/api`, `apps/web`, `packages/shared`), TypeScript strict, ESLint, Prettier, scripts de `CLAUDE.md` | `npm run lint`, `typecheck` e `build` passam |
| F1-T2 | `packages/shared`: tipos (`AccountSnapshot`), schemas zod, constantes de `GAME_RULES.md` | Testes de schema (válido e inválido) |
| F1-T3 | API base: Express, logger, `/health`, validação de env com zod | `GET /health` 200; falha clara com env ausente |
| F1-T4 | Prisma + migração do modelo de `ARCHITECTURE.md` §6; seed das 4 contas | `npm run db:migrate` do zero funciona |
| F1-T5 | Autenticação do painel (login, JWT, refresh, rate limit) | Testes: login ok/erro, token expirado, rate limit |
| F1-T6 | CI (lint, typecheck, testes) | Pipeline verde |

## Fase 2 — Pipeline de status

| ID | Tarefa | Aceite |
| --- | --- | --- |
| F2-T1 | `POST /ingest/snapshot` com token por conta (hash, revogação) | Testes: válido, inválido, duplicado, token errado |
| F2-T2 | Gravar `account_state` e `snapshots`; descarte de snapshot antigo | Teste de idempotência |
| F2-T3 | WebSocket `/ws` autenticado: `account.updated`, `sync.state` | Teste de integração com cliente `ws` |
| F2-T4 | `POST /sync` e `sync.all`; timeout de 10 s por conta; marca `stale` | Teste com ponte simulada |
| F2-T5 | Interface `StatusProvider` + adapter da fonte aprovada em S0.2 (ou `manual`) | Contrato testado com fixture rotulada |
| F2-T6 | Retenção (job diário) e consulta de histórico | Consulta de 24 h em ≤ 300 ms |

## Fase 3 — Interface (Angular PWA)

Referência: `docs/DESIGN.md`.

| ID | Tarefa | Aceite |
| --- | --- | --- |
| F3-T1 | Design tokens, tema e tipografia; cliente WS com reconexão e backoff | Tokens centralizados; queda do WS mostra estado de erro |
| F3-T2 | **Barra global** (Sincronizar tudo, Auto 30 s, última sync, resumo, eventos) | Auto não dispara com sync em andamento; teste de componente |
| F3-T3 | **Painel da conta** + **grid 2×2** ultrawide | Sem rolagem horizontal de 1280 a 2560 px; estados de `DESIGN.md` §2 |
| F3-T4 | **Layout de celular** com abas por conta | Navegação por teclado e `aria-selected`; alvos ≥ 44 px |
| F3-T5 | Viewport do jogo ou botão "Abrir conta", conforme S0.1 | Funciona conforme a decisão do spike |
| F3-T6 | E2E Playwright (sync, auto-sync, abas, estado conflito) | Suíte verde em 2560×1080 e 390×844 |

## Fase 4 — Rotina e alertas

| ID | Tarefa | Aceite |
| --- | --- | --- |
| F4-T1 | Calendário recorrente (`nextEvents`) em `shared`, fuso `America/Sao_Paulo` | Testes de virada de dia, mês e horário de verão |
| F4-T2 | Diário por conta (`daily_tasks`) e lembrete antes das 00:00 | Teste de reset |
| F4-T3 | `deriveAlerts` + tabela `alerts` (abre, não duplica, resolve) | Teste de ciclo de vida |
| F4-T4 | Push PWA (service worker, Web Push, VAPID) | Push chega ao celular em ambiente de teste |

## Fase 5 — Hunts por conta

| ID | Tarefa | Aceite |
| --- | --- | --- |
| F5-T1 | Catálogo de hunts conforme S0.3 (`hunt_catalog`) | Só dados com fonte registrada; lacunas marcadas |
| F5-T2 | `shinyHoursPerEvent` e `rareDropsPerHour` em `shared` | Testes com os valores de `GAME_RULES.md` §4–§5 (ex.: 923 abates/h → ~26 h por shiny) |
| F5-T3 | `GET /hunts` filtrando por nível do treinador, região e métrica | Hunts acima do nível nunca aparecem |
| F5-T4 | Tela de hunts (ficha, abas, chips, tabela) | Conforme `DESIGN.md` §5; "indisponível" onde faltar dado |
| F5-T5 | Raros/h para as Outlands liberadas | Multiplicadores da tabela §4; shiny excluído da Outland |

## Fase 6 — Operação

| ID | Tarefa | Aceite |
| --- | --- | --- |
| F6-T1 | Deploy em `srvsysout` (`/var/www/pokeidle-hub`): nginx, TLS, serviço da API, estáticos do web | Acesso por HTTPS; WS funcionando |
| F6-T2 | Backup diário `pg_dump` e rotação | Restauração testada |
| F6-T3 | Logs estruturados e alarme de `/health` | Falha notificada |
| F6-T4 | Documentação final (README, runbook de deploy, rotação de tokens) | Outra pessoa sobe o projeto só com os docs |

## Backlog (não iniciar sem pedido)

Gráficos de XP/h por conta; modo "foco" que expande uma conta no desktop; exportação CSV do histórico; tipagem do dia no cálculo das hunts (exige modelar o ×2 de `GAME_RULES.md` §6).
