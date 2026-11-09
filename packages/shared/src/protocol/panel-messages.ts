/**
 * Mensagens do WebSocket do painel (`/ws`), versionadas com `v: 1` (ARCHITECTURE.md §5).
 * Servidor → cliente: `account.updated`, `sync.state`, `error`. Cliente → servidor: `sync.all`.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { z } from 'zod';
import type { AccountView } from './account-view.js';
import type { SyncState } from './sync-state.js';

/**
 * Versão do protocolo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const PROTOCOL_VERSION = 1;

/**
 * Mensagens aceitas do painel. Toda entrada do WebSocket é validada com este schema.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const panelClientMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({ v: z.literal(PROTOCOL_VERSION), type: z.literal('sync.all') }),
]);

/** Mensagem do painel para o servidor. */
export type PanelClientMessage = z.infer<typeof panelClientMessageSchema>;

/**
 * Mensagens do servidor para o painel.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type PanelServerMessage =
  | { v: 1; type: 'account.updated'; account: AccountView }
  | { v: 1; type: 'sync.state'; state: SyncState }
  | { v: 1; type: 'error'; code: string; message: string };

/**
 * Códigos de fechamento do WebSocket usados pelo hub (faixa 4000–4999 é da aplicação).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const WS_CLOSE = {
  /** Token de acesso expirou: o painel deve renovar a sessão e reconectar. */
  tokenExpired: 4001,
  /** Substituída por uma conexão mais nova (ponte da mesma conta). */
  replaced: 4002,
  /** Autenticação da ponte falhou ou não chegou a tempo. */
  bridgeAuthFailed: 4003,
} as const;
