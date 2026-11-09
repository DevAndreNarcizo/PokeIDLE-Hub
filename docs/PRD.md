# PRD — PokeIdle Hub

## 1. Problema

O dono joga PokeIdle com 4 contas. Hoje precisa alternar entre abas e aparelhos para saber quem está caçando, quem caiu, quem tem pendência diária e onde cada conta deveria caçar. O jogo permite uma sessão por conta e só roda com a aba aberta, então o acompanhamento disperso custa tempo e deixa passar eventos com prazo.

## 2. Objetivo

Um painel único, só para o dono, que mostre o estado das 4 contas, alerte sobre o que exige ação e sugira onde cada conta deve caçar.

**Objetivo de jogo comum às 4 contas:** subir de nível (XP), caçar shiny e farmar bosses/raros. PvP e torneios não são foco (aparecem apenas como eventos no calendário).

## 3. Fora de escopo

- Ranking, placar, perfil público, multiusuário, cadastro de terceiros, monetização.
- Automação de compra/venda ou qualquer ação no jogo sem clique explícito do dono.
- Guardar senha do jogo.
- Burlar regras do jogo ou limites do servidor.

## 4. Usuário

Um único usuário (o dono), desktop ultrawide e celular. Login simples por senha (hash), sessão com JWT.

## 5. Funcionalidades

### F1 — Barra global de sincronização
- Botão **Sincronizar tudo**: pede snapshot de todas as contas; mostra estado "Sincronizando…" e a hora da última sync.
- Switch **Auto 30 s**: sincroniza sozinho a cada 30 s enquanto ligado (não dispara se já estiver sincronizando).
- Resumo: quantas contas caçando, no Centro e em outro lugar; pendências do dia (X/Y resgatados).
- Próximos eventos (ver `docs/GAME_RULES.md` §11), com o mais urgente em destaque (laranja).
- **Aceite:** com a API fora do ar a barra mostra erro e mantém o último estado marcado como "desatualizado"; nunca mostra dado velho como atual.

### F2 — Painel da conta (desktop: grid 2×2; celular: uma aba por conta)
Cada conta mostra:
- Identificação (Conta N, nível do treinador), **status** com texto e ícone (Caçando, No Centro Pokemon, Aberta em outro lugar, Offline, Desconhecido).
- Hunt atual (região e nível) e vida da equipe (5 barras).
- Métricas da sessão: XP treinador/h, XP pokemon/h, capturas, shiny visto/capturado, Boss Tokens, raros na sessão.
- Boosts ativos com tempo restante; automações (Revive, Poções, Voltar à hunt, Lançar sem parar) com estado ligada/desligada/pausada.
- Diário: Passe de Batalha (dia X/30, resgatado ou pendente) e voto no TopIdle.
- Banner de alerta quando houver (conta em outro lugar com botão **Jogar aqui**; time caiu; automação pausada por falta de item).
- Área do jogo: o jogo proíbe iframe (spike S0.1). Cartão **Sessão do jogo** com status, hunt, hora do último dado e botão **Abrir/Focar conta**, que pede à extensão do perfil da conta para focar a aba (janela dedicada).
- **Aceite:** as 4 contas atualizam em até 2 s após um snapshot; layout sem rolagem horizontal de 360 px a 2560 px.

### F3 — Hunts por conta
- Seletor de conta. Ficha do pokemon ativo vinda da sincronização (sem colar texto).
- Abas **XP/h, Ouro/h, Shiny/h, Raros/h**; chips de região; lista de hunts liberadas para o nível do treinador, ordenada pela aba.
- Colunas: hunt (nome, nível, região, tipos), XP/h, ouro/h, abates/h, "mata em", risco de desmaio, shiny ("1 a cada X h").
- Raros/h lista as Outlands liberadas (única fonte de Bronze Boss Token e fragmentos). Shiny/h exclui a Outland (shiny não rola lá).
- **Aceite:** fórmulas de shiny/h e raros/h conforme `docs/GAME_RULES.md` §5 e §4, com testes unitários. XP/h, ouro/h e abates/h vêm **direto do jogo**: medições reais que a extensão lê das sessões de cada conta, gravadas por hunt (decisão do dono, S0.3). Cada valor mostra a origem (conta e data). Hunt sem medição mostra "sem medição ainda", nunca número estimado. "Mata em" e risco seguem pendentes (`OPEN_QUESTIONS.md` #4, #14).

### F4 — Calendário e rotina diária
- Eventos por horário de Brasília (ver `docs/GAME_RULES.md` §11) com contagem regressiva.
- Pendências por conta (Passe, voto TopIdle) e lembrete antes do reset de 00:00.
- **Aceite:** testes de fuso e de virada de dia; nenhuma data hardcoded de 2026 (as regras são recorrentes).

### F5 — Alertas
Tipos: `team_down`, `no_potions_or_revives`, `session_conflict`, `boost_expiring`, `daily_pending`, `stale_data`.
- Aparecem no painel e, no celular, como push (PWA).
- Cada alerta abre e fecha (resolvido) automaticamente conforme o snapshot; sem duplicar enquanto ativo.
- **Aceite:** teste de ciclo de vida do alerta (abre, não duplica, resolve).

### F6 — Histórico
- Guardar snapshots para gráficos de XP/h e capturas por conta (retenção configurável, padrão 30 dias).
- **Aceite:** consulta por intervalo em até 300 ms para 24 h de dados de uma conta.

## 6. Requisitos não funcionais

- **Segurança:** HTTPS, senha com hash (argon2/bcrypt), JWT de curta duração, token separado por conta para a ponte, rate limit na ingestão, segredos só em variáveis de ambiente.
- **Resiliência:** reconexão automática do WebSocket com backoff; dados marcados como obsoletos após 2× o intervalo de sync.
- **Acessibilidade:** alvos ≥ 44 px, foco visível, `aria-selected`/`role="switch"` onde couber, contraste ≥ 4,5:1, status nunca só por cor.
- **Desempenho:** primeira renderização < 2 s em 4G; WebSocket com mensagens pequenas (apenas deltas quando possível).
- **Observabilidade:** logs estruturados e endpoint `/health`.

## 7. Métricas de sucesso (uso pessoal)

- Ver o estado das 4 contas em menos de 5 s, em qualquer aparelho.
- Zero resgates diários perdidos por esquecimento (Passe e voto).
- Alerta de time caído/sem item chega antes de a conta ficar parada por horas.

## 8. Riscos e dependências

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| O jogo bloqueia iframe | Sem viewport embutido | Spike S0.1; fallback para janelas dedicadas |
| Sem API pública do jogo | Sem fonte de status | Spike S0.2; extensão como ponte; fallback manual |
| Fórmula de XP/h por hunt desconhecida | F3 incompleta | Spike S0.3; exibir "indisponível" até resolver |
| Mudança de regras do jogo | Dados defasados | `GAME_RULES.md` versionado; constantes isoladas em `packages/shared` |
| Violar regras de conduta | Banimento | Hub só observa; ações por clique; revisar Termos |
