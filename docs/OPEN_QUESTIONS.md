# Perguntas em aberto

Mantenha esta lista atualizada. Cada item tem dono e impacto. Não inventar resposta: resolver por spike, pergunta à equipe do jogo ou decisão do dono.

Última revisão: 09/11/2026 (fim da Fase 0).

| # | Pergunta | Dono | Impacto | Resolve em | Situação |
| --- | --- | --- | --- | --- | --- |
| 1 | O `pokeidle.io/app` permite ser embutido em iframe? | Claude Code | Define viewport embutido x janela dedicada | F0-T1 | **Respondida: não** (`X-Frame-Options: DENY`, `frame-ancestors 'none'`). Ver `spikes/S0.1.md` |
| 2 | Existe API pública ou WebSocket de leitura do jogo? | Dono (Discord `#open-ticket`) | Define a fonte de status | F0-T2 | Sem API pública nos Termos/site; WS do cliente é privado. Confirmar no Discord (perguntas em `spikes/S0.2.md`) |
| 3 | A extensão oficial de automação (`#how-to-play`) pode servir de ponte? | Dono | Evita escrever extensão própria | F0-T2 | Aberta: existe e é permitida (Termos §5); falta ver se expõe dados. A "/hunt for PokeIdle" (comunidade, não oficial) foi analisada em `spikes/S0.2.md` |
| 4 | Como o site da comunidade calcula XP/h, ouro/h, abates/h, "mata em" e risco? | Claude Code + dono | Define a Fase 5 | F0-T3 | Dono quer dados diretos: hub usa métricas **medidas** pela extensão por hunt. Projeção de hunts não caçadas segue aberta (`spikes/S0.3.md`) |
| 5 | Qual a lista completa de hunts e seus níveis (Kanto, Hoenn e demais)? | Dono (Mapa em modo Lista, CSV da Pokedex) | Catálogo de hunts | F5-T1 | Aberta |
| 6 | Como obter a tipagem do dia sem modelar o jogo? | Claude Code | Alerta e cálculo com Dia Sazonal | Backlog | **Resolvida:** `diaSazonal.tipo` do estado, pela /hunt |
| 7 | Os sprites do jogo podem ser usados no hub? | Dono | Visual da tela de hunts | F3-T4 | **Recomendação: não.** Termos §2: o jogo não tem direitos sobre nomes e imagens da franquia. Usar placeholder com inicial em definitivo |
| 8 | Qual o apelido/nick de cada conta e o papel de cada uma? | Dono | Rótulos e configuração | F1-T4 | Aberta |
| 9 | Horário-limite para o lembrete de pendências diárias (padrão 18:00)? | Dono | Alerta `daily_pending` | F4-T2 | Aberta |
| 10 | Sem iframe, o que ocupa a área do "viewport do jogo" no painel (620×349)? | Dono | Layout do painel (`DESIGN.md` §3/§4), F3-T3/T5 | Antes da F3 | **Decidida (dono, 09/11):** cartão "Sessão do jogo" no lugar do viewport |
| 11 | Ponte: extensão própria (só leitura do DOM), extensão oficial ou manual? | Dono | Define F2-T5 e a pasta `extension/` | Antes da F2 | **Decidida (dono, 09/11):** extensão própria MV3, só leitura, para Brave, lendo o estado pela /hunt for PokeIdle quando instalada (reserva: tela) |
| 12 | Quais campos do `AccountSnapshot` aparecem na tela logada? | Dono | Matriz da S0.2; o que a extensão consegue ler | F0-T2b | **Resolvida (09/11):** amostra real do estado mapeada (`extension/README.md`). Sem fonte ainda: voto TopIdle, Boss Token, raros, shiny da sessão e ouro da sessão |
| 13 | Como o hub abre/foca cada conta, já que as sessões exigem 4 perfis de navegador separados? | Dono | Botões "Abrir conta" e "Jogar aqui" | F3-T5 | **Implementada (F3-T5):** `POST /accounts/:id/focus` → ponte → a extensão traz a aba do jogo para a frente ou a abre. O clique em "Jogar aqui" dentro do jogo continua sendo do dono |
| 14 | XP por abate, ouro por abate (fórmula), respawn e caminhada por hunt | Dono (equipe do jogo) | Habilita XP/h, ouro/h, abates/h | F5 | Aberta |
| 15 | Limite de contas dos Termos (4 por pessoa, 4 conectadas por rede, mais de 4 no mesmo aparelho = multiconta) | Dono | Risco de banimento permanente | Contínuo | **Fato registrado.** O projeto usa exatamente o limite; o hub nunca cria nem abre uma 5ª conta |
| 16 | Em que idioma a interface do jogo fica em cada perfil? | Dono | O leitor só conhece o texto em português ("Conta aberta em outro lugar") | F2-T5 | Aberta |
| 17 | Por que a "/hunt for PokeIdle" não funciona no Brave? A mesma técnica (ouvir o WebSocket da aba) serviria à nossa ponte | Dono (console do Brave) | Define se a ponte troca a leitura do DOM pela escuta do WebSocket | Antes de mapear a tela | **Respondida:** funciona no Brave depois de recarregar a aba. Falta uma amostra do estado da conta para implementar |
