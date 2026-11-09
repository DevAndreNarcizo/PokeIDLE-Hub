/**
 * Ponto de entrada do pacote compartilhado. Reexporta o contrato do snapshot e as constantes do
 * jogo. As regras de domínio puras entram nas Fases 4 e 5.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export * from './snapshot/account-snapshot.schema.js';
export * from './game-rules/constants.js';
export * from './domain/staleness.js';
export * from './protocol/account-view.js';
export * from './protocol/sync-state.js';
export * from './protocol/panel-messages.js';
export * from './protocol/bridge-messages.js';
export * from './domain/calendar.js';
export * from './domain/alerts.js';
export * from './protocol/alert-view.js';
export * from './domain/alert-text.js';
