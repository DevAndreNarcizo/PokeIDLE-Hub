# Regras do jogo — extraído da wiki oficial do PokeIdle

Fonte: wiki do jogo, versão vigente em **09/11/2026**. Só entra aqui o que a wiki diz. O que não está aqui é **desconhecido** (ver §13). Horários em Brasília (`America/Sao_Paulo`).

## 1. Conta e sessão

- A conta joga em **um lugar por vez**. Abrir em outro aparelho ou aba pausa a sessão antiga (tela "Conta aberta em outro lugar" com botão **Jogar aqui**).
- O jogo **só roda com a aba aberta**. Se a aba fechar ou a internet cair, o servidor segura a sessão por **90 s**; depois disso a hunt fica guardada e o próximo login cai no Centro Pokemon, sem nocaute nem perda de XP.
- Trocar de área: espera de **10 s** entre uma entrada e outra. Sair da hunt pelo botão exige 3 s sem trocar dano.
- Nível do pokemon: entra em campo só se estiver **no máximo 5 níveis acima** do treinador (o inicial é exceção).
- O servidor segura rajadas de ações por segundo por conta.

## 2. Regiões e nível mínimo do treinador

| Região | Nv treinador | Trio de boss (nível fixo) |
| --- | --- | --- |
| Kanto | 1 | Articuno, Moltres, Zapdos — 300 |
| Outland | 150 | (sem boss; dropa o token) |
| Johto | 200 | Suicune, Entei, Raikou — 650 |
| Hoenn | 500 | Groudon, Kyogre, Rayquaza — 3.100 |
| Sinnoh | 1.000 | Dialga, Palkia, Giratina — 9.750 |
| Unova | 5.000 | Reshiram, Zekrom, Kyurem — 22.700 |
| Kalos | 10.000 | Xerneas, Yveltal, Zygarde — 44.050 |
| Alola | 25.000 | Solgaleo, Lunala, Necrozma — 75.900 |
| Galar | 40.000 | Zacian Crowned, Zamazenta Crowned, Eternatus — 120.350 |
| Paldea | 75.000 | Okidogi, Munkidori, Fezandipiti — 179.500 |

Área acima do nível do treinador fica trancada. A hunt mais alta de hoje pede nv 160.300.

## 3. Níveis de hunt conhecidos (lista parcial)

- Johto: 10 hunts, de 30 em 30: 200, 230, 260, 290, 320, 350, 380, 410, 440, 470.
- Sinnoh: citada a hunt nv 1.000.
- Unova: 5.000, 5.400, 5.900, 6.400, 6.950, 8.000, 8.600.
- Kalos: 10.000, 11.250, 12.750, 14.350, 16.000, 20.000, 21.200.
- Alola: 25.000, 26.150, 27.500, 28.950, 30.450, 35.150.
- Galar: 40.000, 42.800, 46.150, 49.650, 53.350, 64.950.
- Paldea: 75.000, 84.650, 95.950, 108.000, 120.550, 160.300.
- Kanto e Hoenn: níveis de hunt **não listados**. **Nomes de hunts: não listados na wiki.**

## 4. Outland (token e raros)

8 Outlands, mesmo mapa e mesmos pokemon (nv 150). Mudam só as chances dos 4 raros (Bronze Boss Token, Fragmento de Chave, de Shiny Stone e de Bicicleta), que multiplicam **depois** do Loot Boost.

| Outland | Nv treinador | Multiplicador | Chance do Bronze Boss Token por abate |
| --- | --- | --- | --- |
| 1 | 150 | ×1 | 0,0500% |
| 2 | 1.000 | ×1,25 | 0,0625% |
| 3 | 2.000 | ×1,5 | 0,0750% |
| 4 | 4.000 | ×2 | 0,10% |
| 5 | 8.000 | ×3 | 0,15% |
| 6 | 16.000 | ×4 | 0,20% |
| 7 | 24.000 | ×6 | 0,30% |
| 8 | 36.000 | ×8 | 0,40% |

- Fragmentos de Chave, Shiny Stone e Bicicleta: **0,000500% por abate** na Outland 1 (× multiplicador da tabela).
- Na Outland **o shiny não rola**.
- Kanto e Orre não dropam o token. Bronze Boss Token não se compra no NPC.
- Boss: o Loot Boost **não** vale. Entrada do boss gasta 1 Bronze Boss Token.

```
rarosPorHora(outland) = abatesPorHora × chanceBase × multiplicador(outland) × lootBoost?
```

## 5. Captura e shiny

```
chance = 0,0075 × (eficiênciaDaBola / fator) × (1,4 − hpAtual/hpMáximo), limitada a [0,30%, 10,0%]
fator: 1º de três = 2,87 · meio (ou 1º de dois) = 3,57 · última/não evolui = 4,47
bola: Poke ×1 · Great ×2 · Super ×3 · Ultra ×4 · Beast ×8
Capture Boost (Loja): dobra a chance, respeitando o teto de 10%
```

- Corpo no chão fica **30 s**; **uma tentativa por corpo** (se a bola falhar, o corpo some).
- Shiny: **1 em 24.000 por tentativa de captura** (1 em 12.000 com Shiny Secret Lure ×2). Bônus de Twitch/Kick/Safari (+15% cada) **multiplicam**. O brilho é sorteado no arremesso.
- Automação **Lançar até Capturar / Lançar sem Parar**: exclusiva de VIP, 1,2 s entre arremessos.

```
horasPorShiny ≈ 24000 / (tentativasPorHora × multiplicadorDeSecretLure)
tentativasPorHora ≈ abatesPorHora      // pressupõe 1 bola por corpo (automação ligada)
```

## 6. Combate (hunt)

```
base  = ((2 × nível/5 + 2) × power × atk/def) / 50 + 2
final = base × STAB(1,5) × efetividade × aleatório(0,85–1,00)
HP de combate = máx(24, arred(hp × 12));  selvagem: HP ×5 e dano ×1,8
```

- Efetividade amplificada na hunt: ×0→0 · ×0,25→0,167 · ×0,5→0,333 · ×1→1 · ×2→2,5 · ×4→5,5.
- Golpe: o pokemon usa o de maior dano esperado entre os carregados. Investida (power 30, física, tipo do pokemon, 2 s) quando todos recarregam.
- Recarga por power: 15→10 s · 40→15,9 s · 60→20,6 s · 80→25,3 s · 100→30 s · 120→31,2 s · 150→33 s · 300→42 s · 600→60 s. Toda última evolução tem dois golpes de 600.
- Speed: desconto máximo de 7% nos golpes (Speed base da espécie × IV de SPD); IV de SPD tira 10 ms por ponto da Investida e do intervalo entre golpes. O stat SPD não acelera a corrida.
- Z-Move: power 2.800, recarga 60 s, área 3×3 em volta do alvo. TM AoE: golpes em área 11×11 em volta do pokemon.
- Stats: `stat = arred((base + 2×IV) × nível/100 × qualidade^expoente × multiplicador)`; expoente 0,95 (HP e Speed) e 0,8 (demais). Shiny ×3; lendário/mítico ×4; potência P1..P5 = ×1, ×1,05, ×1,1, ×1,25, ×2.
- **Dia Sazonal:** às 18:00 sorteia 1 de 18 tipagens; nas hunts do Mapa (Outland inclusa) todo pokemon dela fica ×2 em ataque, defesa e vida (selvagens também). Dano do golpe: tipagem do dia batendo em outra ×2; outra batendo na do dia ×¼; ambas do dia ×½.
- Bicicleta: só encurta caminhada (Comum +15% … Lendária +100%); não vale em PvP, ginásio, guild nem boss.

## 7. XP e boosts

```
xpTotal(L) = arred( 50/3 × (L³ − 6L² + 17L − 12) )     // sem nível máximo
```

Boosts **se multiplicam**: XP Boost ×1,5 (treinador) · XP Boost Pokemon ×1,5 · VIP ×1,5 (nos dois) · Guild +10% · ranking da guild +1% a +10% · Twitch/Kick +15% por hora resgatada · Sacrifício +20% · **Atrasados ×10** (até o nível-alvo; hoje nv 1.089) · eventos. Desmaiar custa 10% do XP do nível atual do treinador (não custa com Atrasados).

Atrasados: sem prazo; acaba ao alcançar o nível dos veteranos; preço proporcional ao XP que falta (mínimo 50 diamantes).

## 8. Ouro por abate

Curva até o nv 25.000 mais bônus de loot (+15%). Exemplos (ouro total por abate, sem Loot Boost): nv 1 → 41 · nv 100 → 658 · nv 1.000 → 2.624 · nv 5.000 → 6.900 · nv 25.000 → 18.142 · nv 160.300 → 31.681. Loot Boost ×1,4. O que cai de selvagem é só **pedra de evolução** (0,2% / 0,35% / 0,5% por estágio, por tipo).

## 9. Automações (padrões)

**Usar Revive**, **Usar Poções** e **Voltar à hunt** já vêm ligadas. Poções: limiar de 10% a 100% (padrão 30%).
**Voltar à hunt** só dispara com poção ou revive na mochila; sem itens ela **pausa** (o interruptor continua ligado) e avisa. Desistir da hunt não aciona a automação.

## 10. Desmaiar

Um pokemon cai → Revive automático (10% HP; Max Revive 100%) ou entra o próximo. Time inteiro cai → Centro Pokemon, Enfermeira Joy cura de graça (não zera a recarga dos golpes). Sair do Centro é escolher outra área no Mapa.

## 11. Calendário recorrente (Brasília)

| Quando | Evento |
| --- | --- |
| 00:00 todo dia | Virada do dia: Passe de Batalha (1 resgate/dia; faltar um dia volta ao Dia 1; 30 dias por ciclo) e voto TopIdle (1 voto/dia; a cada 2 votos, 1 diamante) |
| 18:00 todo dia | Sorteio da tipagem do dia |
| 19:00 todo dia | Guerra de Guilds (simulada no servidor) |
| Segunda 16:00 | Fecha a inscrição do Raid Gigantamax (abre terça 12:00); 20:00 batalha |
| Quarta 20:00 / 21:00 | Showdown: inscrições e equipe travam às 20:00; lutas às 21:00 |
| Dia 13 / 15 | Amador: inscrições dias 1–13; lutas dia 15 às 00:00 |
| Dia 28 / último dia | Mundial: inscrições dias 16–28; lutas no último dia às 00:00 |
| Sábado 23:59 | Virada semanal: PvP Ranqueado e Top Catch zeram |
| Dia 1, 00:00 | Fechamento mensal (Guild Global, Top Treinadores etc.) |

Próximas datas na wiki: Showdown #5 em 11/11/2026; Amador em 15/11; Mundial em 30/11.

## 12. Bosses (para Raros)

Entrada: 1 Bronze Boss Token. O boss luta sempre no nível dele. Equipe com 5+ pokemon no nível do boss: ×1 de dano recebido; cada pokemon a menos ×3. Drops por posição na trinca: 1º = Fragmento de Z-Move e TM AoE Piece (0,50% em Kanto até 4,50% em Paldea); 2º = Fragmento de Mega Stone (mesma escada) e Mega Shiny (metade); 3º = Mystic Ticket (0,000500% em Kanto, +0,000500% por região) e Safari Ticket (0,25% em Kanto, +0,25% por região).

## 13. Desconhecido — NÃO inventar

- Nome e lista completa das hunts de cada região.
- Existência de API pública ou WebSocket do jogo.
- Algoritmo que calcula XP/h, ouro/h, abates/h, "mata em" e risco por hunt (o site da comunidade usa a ficha do pokemon).
- Se `pokeidle.io/app` permite iframe.
- Qual tipagem está ativa no Dia Sazonal sem ler o jogo.
- Valores de XP por abate por espécie (o catálogo da Pokedex exporta .csv com stats e golpes; XP por abate não está descrito na wiki).
