/**
 * Estado da sincronização global (barra "Sincronizar tudo", ARCHITECTURE.md §7).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { z } from 'zod';

/**
 * Situação de cada conta numa rodada de sincronização:
 * `pending` aguardando; `ok` respondeu; `timeout` não respondeu em 10 s;
 * `unavailable` sem ponte conectada para a conta.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const accountSyncResultSchema = z.enum(['pending', 'ok', 'timeout', 'unavailable']);

/**
 * Estado da sincronização.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const syncStateSchema = z.strictObject({
  status: z.enum(['idle', 'running']),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  accounts: z.strictObject({
    '1': accountSyncResultSchema.nullable(),
    '2': accountSyncResultSchema.nullable(),
    '3': accountSyncResultSchema.nullable(),
    '4': accountSyncResultSchema.nullable(),
  }),
});

/** Resultado por conta. */
export type AccountSyncResult = z.infer<typeof accountSyncResultSchema>;
/** Estado da sincronização. */
export type SyncState = z.infer<typeof syncStateSchema>;

/**
 * Estado inicial: nunca sincronizado.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function initialSyncState(): SyncState {
  return {
    status: 'idle',
    startedAt: null,
    finishedAt: null,
    accounts: { '1': null, '2': null, '3': null, '4': null },
  };
}
