/**
 * Utilitários de teste da API: ambiente válido e logger silencioso.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { createLogger } from '../src/logger.js';
import type { Logger } from '../src/logger.js';

/**
 * Variáveis de ambiente válidas para testes (valores fictícios, sem credenciais reais).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const TEST_ENV_VARS = {
  NODE_ENV: 'test',
  CORS_ORIGIN: 'http://localhost:4200',
  DATABASE_URL: 'postgresql://hub:hub@localhost:5432/pokeidle_hub_test',
} as const;

/**
 * Logger que não escreve nada.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function silentLogger(): Logger {
  return createLogger('silent');
}
