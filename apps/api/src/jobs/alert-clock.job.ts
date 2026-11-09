/**
 * Relógio dos alertas: reavalia as contas a cada minuto, porque boosts, diário e dado obsoleto
 * mudam só com a passagem do tempo, sem snapshot novo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AlertService } from '../alerts/alert.service.js';

/**
 * Agenda a reavaliação periódica.
 *
 * @param alerts Serviço de alertas.
 * @param intervalMs Intervalo (padrão 60 s).
 * @returns Função para parar.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function startAlertClock(
  alerts: Pick<AlertService, 'evaluateAll'>,
  intervalMs = 60_000,
): () => void {
  const timer = setInterval(() => void alerts.evaluateAll(new Date()), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
