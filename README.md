# PokeIdle Hub

Painel pessoal para acompanhar e gerenciar 4 contas do [PokeIdle](https://pokeidle.io/app) num só lugar.

> Status: Fases 0, 1 e 2 entregues (a leitura detalhada da tela do jogo pela extensão aguarda o mapeamento da tela logada, `docs/OPEN_QUESTIONS.md` #12). Próxima: Fase 3 (interface). Siga `docs/ROADMAP.md`. O projeto é de uso individual (sem ranking, sem multiusuário).

## O que faz

- **Grid 2×2** no desktop ultrawide: uma conta por quadrante, com status, hunt, equipe, métricas, boosts, automações e pendências diárias.
- **Barra global de sincronização**: "Sincronizar tudo", sincronização automática a cada 30 s, resumo do estado das contas e próximos eventos.
- **Celular**: uma aba por conta, com a mesma barra global no topo.
- **Hunts por conta**: ficha do pokemon ativo e lista de hunts ordenável por XP/h, ouro/h, shiny/h e raros/h.
- **Alertas**: time caiu, sem poção ou revive, conta aberta em outro lugar, boost perto de vencer, pendências do dia.

## Documentação

| Arquivo | Conteúdo |
| --- | --- |
| `CLAUDE.md` | Instruções permanentes para o Claude Code |
| `docs/PRD.md` | Produto, escopo, funcionalidades e critérios de aceite |
| `docs/ARCHITECTURE.md` | Arquitetura, contratos, modelo de dados, segurança e deploy |
| `docs/GAME_RULES.md` | Regras e fórmulas do jogo (fonte: wiki oficial) |
| `docs/DESIGN.md` | Tokens e telas |
| `docs/ROADMAP.md` | Fases e tarefas, com critérios de aceite |
| `docs/OPEN_QUESTIONS.md` | Dúvidas em aberto sobre o jogo e decisões pendentes |

## Estrutura planejada

```
pokeidle-hub/
├── apps/
│   ├── api/            # Node + TypeScript (Express, ws, Prisma)
│   └── web/            # Angular PWA
├── packages/
│   └── shared/         # tipos, schemas zod, regras de domínio puras
├── extension/          # ponte navegador → API (se o spike S0.2 aprovar)
├── docs/
├── CLAUDE.md
└── README.md
```

## Requisitos

- Node.js LTS, npm
- PostgreSQL
- Servidor Linux para deploy (`srvsysout`, em `/var/www/pokeidle-hub`)

## Configuração

Requer Node.js 22 (`.nvmrc`) e PostgreSQL 16.

```bash
npm install
cp .env.example .env
npm run hash-password -w @pokeidle-hub/api   # digite a senha do painel; cole o hash no .env
openssl rand -base64 48                      # cole em HUB_JWT_SECRET
npm run db:migrate                           # cria as tabelas e as 4 contas
npm run dev                                  # API em :3000 e painel em :4200
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | API (tsx watch) e painel (ng serve, com proxy `/api` e `/ws`) |
| `npm run build` | Build de shared, api e web |
| `npm test` | Testes unitários (Vitest). Com `TEST_DATABASE_URL`, roda também os de integração com o banco |
| `npm run lint` / `npm run typecheck` / `npm run format:check` | Qualidade |
| `npm run db:migrate` | Migrações (desenvolvimento) e seed |
| `npm run db:deploy -w @pokeidle-hub/api` | Migrações em produção e seed |
| `npm run bridge-token -w @pokeidle-hub/api -- issue <1-4>` | Gera o token da ponte de uma conta (mostrado uma vez); `revoke <1-4>` revoga |
| `npm run build -w @pokeidle-hub/extension` | Gera a extensão para o Brave em `extension/dist` (instalação em `extension/README.md`) |

Nunca versione o `.env`. O hub não guarda a senha do jogo.

## Decisões da Fase 0

- O jogo **proíbe iframe**: cada conta roda na própria janela, em 4 perfis do Brave (`docs/spikes/S0.1.md`).
- Fonte de status: **extensão própria só de leitura para Brave** (`docs/spikes/S0.2.md`).
- Métricas de hunt **medidas** nas sessões reais, nunca estimadas (`docs/spikes/S0.3.md`).

## Autor

André Narcizo — andre.narcizo@sysout.com.br
