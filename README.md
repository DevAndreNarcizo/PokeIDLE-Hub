# PokeIdle Hub

Painel pessoal para acompanhar e gerenciar 4 contas do [PokeIdle](https://pokeidle.io/app) num só lugar.

> Status: em planejamento. Siga `docs/ROADMAP.md`. O projeto é de uso individual (sem ranking, sem multiusuário).

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

## Configuração (após a Fase 1)

```bash
cp .env.example .env     # preencha DATABASE_URL, HUB_ADMIN_PASSWORD_HASH, HUB_JWT_SECRET
npm install
npm run db:migrate
npm run dev
```

Nunca versione o `.env`. O hub não guarda a senha do jogo.

## Autor

André Narcizo — andre.narcizo@sysout.com.br
