/**
 * Mensagens da ponte extensão ↔ API (WebSocket `/bridge`), versionadas com `v: 1`
 * (ARCHITECTURE.md §5). A extensão abre a conexão, autentica com `hello` (token da conta) e passa
 * a responder `sync.request` com `snapshot`.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { z } from 'zod';
import { accountSnapshotSchema } from '../snapshot/account-snapshot.schema.js';
import type { AccountId } from '../snapshot/account-snapshot.schema.js';
import { PROTOCOL_VERSION } from './panel-messages.js';

/**
 * Mensagens da extensão para a API.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const bridgeClientMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal('hello'),
    token: z.string().min(1).max(200),
    /** Versão da extensão, para diagnóstico. */
    extensionVersion: z.string().max(32),
  }),
  /** Mantém o service worker do MV3 ativo (mensagem a cada 20 s); o servidor só ignora. */
  z.strictObject({ v: z.literal(PROTOCOL_VERSION), type: z.literal('ping') }),
  z.strictObject({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal('snapshot'),
    /** Pedido que este snapshot responde; `null` quando enviado por iniciativa da extensão. */
    requestId: z.string().max(64).nullable(),
    snapshot: accountSnapshotSchema,
  }),
]);

/** Mensagem da extensão. */
export type BridgeClientMessage = z.infer<typeof bridgeClientMessageSchema>;

/**
 * Mensagens da API para a extensão.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type BridgeServerMessage =
  | { v: 1; type: 'hello.ok'; accountId: AccountId }
  | { v: 1; type: 'sync.request'; requestId: string }
  | { v: 1; type: 'snapshot.ack'; requestId: string | null; status: 'stored' | 'duplicate' }
  | { v: 1; type: 'error'; code: string; message: string };

/**
 * Valida uma mensagem da API recebida pela extensão.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const bridgeServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal('hello.ok'),
    accountId: z.number().int().min(1).max(4),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal('sync.request'),
    requestId: z.string().max(64),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal('snapshot.ack'),
    requestId: z.string().max(64).nullable(),
    status: z.enum(['stored', 'duplicate']),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal('error'),
    code: z.string(),
    message: z.string(),
  }),
]);
