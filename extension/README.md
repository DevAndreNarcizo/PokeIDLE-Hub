# PokeIdle Hub — Ponte (extensão para Brave)

Extensão Manifest V3, **somente leitura**: lê o que está visível na aba do PokeIdle e envia ao seu
hub. Não clica, não digita e não faz requisições ao servidor do jogo (CLAUDE.md, regra 3).

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
4. Clique no ícone da extensão, informe o endereço do hub (`https://…`; `http://localhost` só em
   desenvolvimento) e o token, e salve. O estado deve mudar para "Conectado ao hub como Conta 1".
5. Repita para as Contas 2, 3 e 4, cada uma no seu perfil e com o seu token.

Para revogar um token: `npm run bridge-token -w @pokeidle-hub/api -- revoke 1`.

## O que já é lido

| Campo | Situação |
| --- | --- |
| `status = conflict` | Lido pelo texto "Conta aberta em outro lugar" (`GAME_RULES.md` §1) |
| `status = offline` | Nenhuma aba do jogo aberta no perfil |
| Demais campos | `null` até o dono mapear a tela logada (`OPEN_QUESTIONS.md` #12). Seletores ficam só em `src/reader/selectors.ts` |

## Como funciona

O service worker mantém um WebSocket com `/bridge` do hub, autentica com `hello` + token e responde
cada `sync.request` lendo a aba do jogo pelo content script. Envia `ping` a cada 20 s para o Brave
não suspender o service worker; se ele for suspenso mesmo assim, um alarme a cada 30 s reconecta.
