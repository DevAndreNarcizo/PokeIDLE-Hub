/**
 * Pontos de leitura da interface do jogo, isolados num único módulo (S0.2: o DOM muda a cada
 * versão do cliente; hoje 1.414.1). Só entra aqui o que está documentado.
 *
 * TODO(game-data): seletores de nível, hunt, equipe, mochila, boosts, automações, diário e
 * tipagem do dia dependem da inspeção da tela logada pelo dono (OPEN_QUESTIONS.md #12).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */

/**
 * Textos de tela documentados em GAME_RULES.md §1 (interface em português).
 * TODO(game-data): equivalentes em inglês e espanhol, se o dono usar outro idioma.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const SCREEN_TEXT = {
  /** Tela exibida quando a conta é aberta em outro lugar. */
  conflict: 'Conta aberta em outro lugar',
} as const;
