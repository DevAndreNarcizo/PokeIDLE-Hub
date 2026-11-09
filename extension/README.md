# PokeIdle Hub — Ponte (extensão para Brave)

Extensão Manifest V3, **somente leitura**: lê o que está visível na aba do PokeIdle e envia ao seu
hub. Não clica, não digita e não faz requisições ao servidor do jogo (CLAUDE.md, regra 3).

## Fonte dos dados

A ponte lê o estado da conta de duas formas (decisão do dono, 09/11/2026):

1. **Pela extensão "/hunt for PokeIdle"** (de terceiro, Chrome Web Store), se estiver instalada no mesmo perfil. Ela
   escuta o WebSocket do jogo e remonta o estado; um script desta extensão (`page-bridge.js`, no contexto da página)
   assina esse estado e repassa **só** os campos usados pelo hub. É a fonte completa (`reader = hunt_extension`).
2. **Pela tela** (reserva), quando a /hunt não está instalada ou parou de entregar dados há mais de 2 min
   (`reader = dom`, bem mais limitada).

O painel mostra a fonte no cartão "Sessão do jogo" ("Fonte: /hunt" ou "Fonte: tela (limitada)"), e a página de
opções desta extensão também.

## Instalação (uma vez por conta)

As sessões do jogo ficam nos cookies de cada perfil, então cada conta precisa do próprio perfil do
Brave (`docs/spikes/S0.1.md`). Os Termos do jogo permitem até 4 contas por pessoa e por aparelho.

1. Gere o pacote: `npm run build -w @pokeidle-hub/extension` (sai em `extension/dist/`).
2. No hub, gere o token da conta (mostrado uma única vez):
   ```bash
   npm run bridge-token -w @pokeidle-hub/api -- issue 1
   ```
3. No Brave, abra o perfil da Conta 1 → `brave://extensions` → ative **Modo do desenvolvedor** →
   **Carregar sem compactação** → escolha `extension/dist`.
4. No mesmo perfil, instale a "/hunt for PokeIdle" pela Chrome Web Store e **recarregue a aba do jogo** (extensões
   que entram no início do carregamento da página só valem para abas abertas depois da instalação).
5. Clique no ícone da extensão, informe o endereço do hub (`https://…`; `http://localhost` só em
   desenvolvimento) e o token, e salve. O estado deve mudar para "Conectado ao hub como Conta 1".
6. Repita para as Contas 2, 3 e 4, cada uma no seu perfil e com o seu token.

Para revogar um token: `npm run bridge-token -w @pokeidle-hub/api -- revoke 1`.

## O que já é lido

| Campo | Fonte |
| --- | --- |
| `trainerLevel`, `activePokemon`, `inventory.balls`, `boosts`, `seasonalTypeOfDay` | /hunt (campos conferidos no código dela, versão 1.0.17) |
| `status = conflict` | Tela: texto "Conta aberta em outro lugar" (`GAME_RULES.md` §1). Em conflito a /hunt não é usada |
| `status = offline` | Nenhuma aba do jogo aberta no perfil |
| Automações, diário, contadores da sessão, hunt atual, status caçando/Centro | `null` até chegar uma amostra real do estado (`docs/OPEN_QUESTIONS.md` #12) |

## Como funciona

O service worker mantém um WebSocket com `/bridge` do hub, autentica com `hello` + token e responde
cada `sync.request` lendo a aba do jogo pelo content script. Envia `ping` a cada 20 s para o Brave
não suspender o service worker; se ele for suspenso mesmo assim, um alarme a cada 30 s reconecta.
