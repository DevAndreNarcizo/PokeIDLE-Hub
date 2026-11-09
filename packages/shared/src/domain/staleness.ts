/**
 * Regra de dado obsoleto (ARCHITECTURE.md §7–§8 e PRD §6): um estado é "desatualizado" quando o
 * último recebimento tem mais de 2 × o intervalo de sincronização.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */

/**
 * Intervalo da sincronização automática (PRD F1: "Auto 30 s").
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const SYNC_INTERVAL_MS = 30_000;

/**
 * Idade máxima de um dado antes de ser considerado obsoleto (2 × intervalo).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const STALE_AFTER_MS = 2 * SYNC_INTERVAL_MS;

/**
 * Tempo máximo de espera pela resposta de uma conta numa sincronização (ARCHITECTURE.md §7).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const SYNC_TIMEOUT_MS = 10_000;

/**
 * Diz se um dado recebido em `receivedAt` está obsoleto em `now`.
 *
 * @param receivedAt Instante do recebimento (ISO 8601 ou Date); `null` = nunca recebido.
 * @param now Instante de referência.
 * @param staleAfterMs Idade limite (padrão: {@link STALE_AFTER_MS}).
 * @returns `true` quando nunca recebido ou mais velho que o limite.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function isStale(
  receivedAt: string | Date | null,
  now: Date,
  staleAfterMs = STALE_AFTER_MS,
): boolean {
  if (receivedAt === null) {
    return true;
  }
  const at = typeof receivedAt === 'string' ? Date.parse(receivedAt) : receivedAt.getTime();
  return Number.isNaN(at) || now.getTime() - at > staleAfterMs;
}
