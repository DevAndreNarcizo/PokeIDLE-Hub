# Design — PokeIdle Hub

Referência visual: canvas de Design "PokeIdle Hub" (privado do dono). Este documento é a especificação textual; em caso de divergência, vale este arquivo. Capturas do canvas devem ser exportadas para `docs/design/` antes do desenvolvimento.

Telas no canvas: **Desktop ultrawide 2×2** (2560×1080), **Celular com abas** (390×844), **Hunts por conta** (página fluida), **Planejamento** (documento de apoio).

## 1. Tokens

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | `#0B0E13` | Fundo da página |
| `--surface` | `#131821` | Painéis |
| `--surface-2` | `#1A212C` | Cards internos, chips |
| `--border` | `#263042` | Bordas |
| `--border-2` | `#354258` | Bordas tracejadas, destaques |
| `--text` | `#E8ECF2` | Texto principal |
| `--text-2` | `#C3CCD9` | Texto secundário |
| `--muted` | `#9AA6B8` | Rótulos |
| `--accent` | `#F2B53C` | Ação principal (configurável) |
| `--accent-ink` | `#1A1300` | Texto sobre o accent |
| `--ok` | `#3DD6B0` | Caçando, ligado, resgatado |
| `--info` | `#8AB4FF` | No Centro, foco |
| `--warn` | `#FF9F5A` | Alerta, pendente, em outro lugar |
| `--off` | `#6B7789` | Desligado |

Tipografia: **Space Grotesk** (títulos e números, 600–700) e **Inter** (corpo, 400–600). Números com `font-variant-numeric: tabular-nums`. Corpo 14 px; rótulos 12 px; títulos de painel 18–20 px; barra global 20 px.
Raios: 14 px painéis, 10 px cards e botões, 8 px chips, 999 px pílulas de status.
Alvos de toque ≥ 44 px. Foco visível: contorno de 2 px em `--info`.

Selos de tipo (texto branco, 4,5:1): Fire `#C4461C`, Flying `#4A6FB5`, Grass `#2F7D32`, Bug `#5E7F1A`, Poison `#8A3FB0`, Ice `#1F7FA0`, Ground `#8A6A2A`, Psychic `#B03A7A`; demais tipos devem seguir a mesma regra de contraste.

## 2. Estados de conta

| Status | Rótulo | Cor | Observação |
| --- | --- | --- | --- |
| `hunting` | Caçando | `--ok` | |
| `center` | No Centro Pokemon | `--info` | Pode ter banner "time caiu" |
| `conflict` | Aberta em outro lugar | `--warn` | Banner com botão **Jogar aqui**; métricas "—" |
| `offline` | Offline | `--off` | |
| `unknown` / dado obsoleto | Desatualizado | `--off` | Mostrar hora do último dado |

Status **nunca só por cor**: ponto + texto (e ícone em alertas).

## 3. Desktop ultrawide (grid 2×2)

- Raiz com 20 px de padding, coluna: **barra global** (76 px) + **grid** 2×2 (gap 16 px), ocupando o restante da altura.
- **Barra global**: marca (quatro quadrados) e "PokeIdle Hub"; pílulas de resumo (caçando, no Centro, em outro lugar, diário X/Y); lista de eventos (rótulo + texto, o mais urgente em `--warn`); switch **Auto 30 s**, **Última sync** (hora) e botão **Sincronizar tudo** (ícone gira enquanto sincroniza).
- **Painel da conta** (cabeçalho 36 px de número + nome + nível + chip de status): corpo em duas colunas — esquerda 620 px com **viewport do jogo** (16:9, 620×349) e barras de equipe; direita com banner (se houver), grade de 6 métricas (3 colunas), boosts, automações e diário.
- Em larguras menores que o desktop ultrawide, o grid vira 1 coluna de painéis empilhados; abaixo de ~820 px usar o layout de celular.

## 4. Celular (390 px)

- Cabeçalho fixo: marca, hora da última sync, botão **Sincronizar** (44 px), resumo das contas, switch Auto.
- **Abas** das 4 contas (grade de 4, 56 px de altura): ponto de status + "Conta N" + nível; aba ativa com borda `--accent`. `role="tablist"`, `aria-selected`.
- Conteúdo rolável da conta em foco: título e chip, banner, viewport 16:9 (largura total), equipe, métricas em 2 colunas, boosts, automações, diário e **Próximos eventos** (comuns às contas).

## 5. Hunts por conta

- Cabeçalho "Onde caçar?" e seletor de conta (4 botões).
- Coluna esquerda (360 px): **Pokemon ativo e nível do treinador** vindos da sincronização; ficha com nome, nível, selos de tipo, P·Q·IV e 6 stats com IV.
- Coluna direita: abas **XP/h · Ouro/h · Shiny/h · Raros/h**; chips de região (Todas, Kanto, Outland, Johto…; com o melhor XP/h quando a aba é XP/h); nota explicativa por aba; **tabela** com colunas HUNT (sprite, nome, nível, região, tipos), XP/H, OURO/H, ABATES/H, MATA EM, RISCO, SHINY ("1 a cada X h"). A coluna da métrica ativa recebe selo verde; risco ≥ 10% em laranja com ▲.
- **Sem ranking**: sem coluna de posição, sem destaque de "melhor hunt". Ordenação pela aba ativa.
- Conta sem ficha sincronizada ou em conflito: estado vazio com a causa e a ação.
- Sprites de pokemon são arte do jogo: **não** copiar para o repositório sem checar permissão; usar placeholder com inicial até definir a fonte.

## 6. Acessibilidade

Elementos interativos como `<button>`/`<a>`/`<input>`; switch com `role="switch"` e `aria-checked`; ícones só decorativos com `aria-hidden`; contraste ≥ 4,5:1 (texto de 24 px+ ≥ 3:1); evitar vermelho e verde como único diferencial; `prefers-reduced-motion` desliga a rotação do ícone de sync.

## 7. Dados de exemplo

Os números do canvas são **ilustrativos**. Não usar como dado real nem como fixture de teste sem rotular.
