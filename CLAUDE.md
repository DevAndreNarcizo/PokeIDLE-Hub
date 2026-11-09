# CLAUDE.md — PokeIdle Hub

Instruções permanentes para o Claude Code neste repositório. Leia este arquivo inteiro antes de qualquer tarefa.

## O que é o projeto

Painel pessoal (um único usuário: o dono) para acompanhar e gerenciar **4 contas** do jogo idle PokeIdle (`https://pokeidle.io/app`) num só lugar. Tem barra global de sincronização, grid 2×2 no desktop ultrawide, abas por conta no celular e uma tela de hunts por conta.

- Dono e autor: André Narcizo — andre.narcizo@sysout.com.br
- Caminho no servidor: `/var/www/pokeidle-hub` (VPS `srvsysout`, Linux)
- Idioma da interface e dos documentos: pt-BR. Fuso: `America/Sao_Paulo`.
- Escopo: uso pessoal. **Não há ranking, multiusuário, cadastro público nem monetização.**

## Fontes da verdade (leia na ordem)

1. `docs/PRD.md` — o que construir e critérios de aceite.
2. `docs/ARCHITECTURE.md` — como construir, contratos e modelo de dados.
3. `docs/GAME_RULES.md` — regras e fórmulas do jogo, extraídas da wiki oficial.
4. `docs/DESIGN.md` — tokens e telas (referência visual: canvas de Design do projeto).
5. `docs/ROADMAP.md` — fases, tarefas e critérios. **Execute nesta ordem.**

## Regras inegociáveis

1. **Não invente dado do jogo.** Se um número, fórmula ou nome não estiver em `docs/GAME_RULES.md`, trate como desconhecido: deixe `TODO(game-data)` no código, registre em `docs/OPEN_QUESTIONS.md` e pergunte ao dono. Isso inclui nomes de hunts, API do jogo e cálculo de XP/h por hunt.
2. **Sem credenciais no repositório.** Nada de senha, cookie ou token real em código, testes ou commits. Use `.env` (fora do git) e `.env.example`. O hub nunca guarda a senha do jogo.
3. **O hub observa; ações no jogo só por clique explícito do usuário.** Os Termos do jogo permitem automação, mas as regras de conduta valem para todos. Não contorne limites do servidor, não explore falhas e não automatize negociação fora do Mercado da Comunidade.
4. **Uma sessão por conta.** Abrir a conta em outro lugar pausa a sessão antiga. O hub trata isso como estado (`conflict`) e nunca retoma sozinho.
5. **Ordem das fases.** Não pule a Fase 0 (spikes). Ao terminar cada spike, pare e reporte o resultado antes de seguir: ele decide a arquitetura.
6. **Mudança de escopo** (ex.: adicionar ranking, multiusuário) exige confirmação explícita do dono.

## Stack

- Monorepo com npm workspaces: `apps/web` (Angular, PWA), `apps/api` (Node.js + TypeScript, Express + `ws`), `packages/shared` (tipos e validação com zod), `extension/` (ponte, se o spike aprovar).
- PostgreSQL. Acesso via Prisma.
- TypeScript em modo `strict`. Testes: Vitest (api/shared), Jasmine/Karma ou Jest conforme o padrão do Angular da versão escolhida (web), Playwright para E2E.
- Detalhes e justificativas em `docs/ARCHITECTURE.md`.

## Convenções de código

- Clean Code e SOLID quando fizer sentido; sem soluções improvisadas. Prefira clareza e robustez.
- **Todo arquivo novo, classe, função exportada e bloco relevante leva comentário JSDoc neste formato exato:**

```ts
/**
 * Descrição objetiva e técnica do propósito. Explique o contexto quando necessário.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
```

- Comentários inline apenas em trechos críticos ou não triviais (regras de negócio, fórmulas, concorrência).
- Datas em UTC no banco e na API (ISO 8601); conversão para `America/Sao_Paulo` só na borda de exibição. Números exibidos em pt-BR.
- Validação de toda entrada externa com zod nos limites do sistema (ingestão do snapshot, WebSocket, variáveis de ambiente).
- Sem `any`. Sem `console.log` em código de produção (use o logger do projeto).
- Commits no padrão Conventional Commits. Um commit por tarefa do roadmap, com o ID da tarefa (ex.: `feat(api): ingestão de snapshot (F2-T1)`).

## Definition of Done (toda tarefa)

- Critérios de aceite da tarefa no `docs/ROADMAP.md` atendidos.
- Testes escritos e passando; `npm run lint` e `npm run typecheck` limpos.
- Documentação tocada atualizada (README, docs, `.env.example`).
- Nenhum dado de jogo inventado; dúvidas registradas em `docs/OPEN_QUESTIONS.md`.

## Comandos esperados (crie-os na Fase 1)

```
npm run dev          # api + web em modo desenvolvimento
npm run build        # build de todos os workspaces
npm run test         # testes unitários
npm run test:e2e     # Playwright
npm run lint
npm run typecheck
npm run db:migrate   # Prisma migrate
```

## Como trabalhar comigo (o dono)

- Seja direto e técnico. Aponte riscos, gargalos e dívidas técnicas quando os identificar.
- Quando houver mais de um caminho razoável, apresente a recomendação com a justificativa em poucas linhas e siga com ela, a menos que a decisão seja irreversível ou mude o escopo.
- Sugira melhorias de estrutura e boas práticas adicionais, mas implemente só o que está no roadmap.
