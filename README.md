# PokeIdle Hub

Painel pessoal para acompanhar e gerenciar 4 contas do [PokeIdle](https://pokeidle.io/app) num só lugar.

> Status: Fases 0 a 6 do `docs/ROADMAP.md` implementadas. Pendências que dependem do dono estão em
> `docs/OPEN_QUESTIONS.md`. Uso individual: sem ranking, sem multiusuário.

## O que faz

- **Grid 2×2** no desktop ultrawide (a partir de 2200×900 px) e coluna única em telas menores: status, hunt, equipe, métricas, boosts, automações, diário e alertas de cada conta.
- **Barra global**: "Sincronizar tudo", Auto 30 s, última sync, resumo das contas e próximos eventos do jogo (horário de Brasília).
- **Celular**: uma aba por conta, com a barra no topo e "Próximos eventos".
- **Onde caçar?**: ficha do pokemon ativo e hunts liberadas com XP/h, ouro/h, abates/h e shiny/h **medidos** nas sessões reais; raros/h nas Outlands.
- **Alertas**: conta aberta em outro lugar, time caiu, sem poção/revive, boost acabando, pendência diária e dado desatualizado, no painel e por **push** no celular (PWA).
- **Extensão para Brave** (somente leitura) que envia o estado de cada conta ao hub.

## Documentação

| Arquivo | Conteúdo |
| --- | --- |
| `CLAUDE.md` | Instruções permanentes para o Claude Code |
| `docs/PRD.md` | Produto, escopo, funcionalidades e critérios de aceite |
| `docs/ARCHITECTURE.md` | Arquitetura, contratos, modelo de dados, segurança e deploy |
| `docs/GAME_RULES.md` | Regras e fórmulas do jogo (fonte: wiki oficial) |
| `docs/DESIGN.md` | Tokens e telas |
| `docs/ROADMAP.md` | Fases e tarefas, com critérios de aceite |
| `docs/OPEN_QUESTIONS.md` | Dúvidas em aberto e decisões |
| `docs/spikes/` | Resultados da Fase 0 (iframe, fonte de status, XP/h) |
| `docs/RUNBOOK.md` | Instalação no servidor, deploy, rotação de segredos, backup e problemas comuns |
| `extension/README.md` | Instalação da extensão em cada perfil do Brave |

## Estrutura

```
pokeidle-hub/
├── apps/
│   ├── api/            # Node + TypeScript (Express, ws, Prisma 7)
│   └── web/            # Angular 22 PWA
├── packages/
│   └── shared/         # tipos, schemas zod, regras puras do jogo (calendário, alertas, fórmulas)
├── extension/          # ponte Brave (Manifest V3), somente leitura
├── e2e/                # Playwright
├── deploy/             # nginx, systemd, deploy, backup, alarme do /health
└── docs/
```

## Desenvolvimento local

Requer Node.js 22 (`.nvmrc`) e PostgreSQL 16.

```bash
npm install
cp .env.example .env
npm run hash-password -w @pokeidle-hub/api   # digite a senha do painel; cole o hash no .env (entre aspas simples)
openssl rand -base64 48                      # cole em HUB_JWT_SECRET
npm run db:migrate                           # tabelas, as 4 contas e o catálogo de hunts
npm run dev                                  # API em :3000 e painel em :4200
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | API (tsx watch) e painel (ng serve, com proxy `/api` e `/ws`) |
| `npm run build` | Build de shared, api, web e extensão |
| `npm test` | Testes unitários (Vitest). Com `TEST_DATABASE_URL`, roda também os de integração |
| `npm run test:e2e` | Playwright em 2560×1080 e 390×844 (exige `TEST_DATABASE_URL`) |
| `npm run lint` / `npm run typecheck` / `npm run format:check` | Qualidade |
| `npm run db:migrate` | Migrações (desenvolvimento) e seed |
| `npm run db:deploy -w @pokeidle-hub/api` | Migrações em produção e seed |
| `npm run bridge-token -w @pokeidle-hub/api -- issue <1-4>` | Token da ponte de uma conta (mostrado uma vez); `revoke <1-4>` revoga |
| `npm run vapid-keys -w @pokeidle-hub/api` | Chaves do Web Push |
| `npm run build -w @pokeidle-hub/extension` | Extensão em `extension/dist` |

Produção: `docs/RUNBOOK.md`. Nunca versione o `.env`. O hub não guarda a senha do jogo.

## Decisões da Fase 0

- O jogo **proíbe iframe**: cada conta roda na própria janela, em 4 perfis do Brave (`docs/spikes/S0.1.md`).
- Fonte de status: **extensão própria só de leitura para Brave** (`docs/spikes/S0.2.md`).
- Métricas de hunt **medidas** nas sessões reais, nunca estimadas (`docs/spikes/S0.3.md`).

## Autor

André Narcizo — andre.narcizo@sysout.com.br
