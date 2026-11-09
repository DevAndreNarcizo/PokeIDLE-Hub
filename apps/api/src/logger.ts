/**
 * Logger estruturado em JSON (pino). Único canal de log da API: não usar `console`.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { pino } from 'pino';
import type { Logger, LevelWithSilent } from 'pino';

/**
 * Cria o logger da aplicação, redigindo campos sensíveis (senha, tokens, cookies).
 *
 * @param level Nível mínimo de log.
 * @returns Instância do pino.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function createLogger(level: LevelWithSilent): Logger {
  return pino({
    level,
    base: { service: 'pokeidle-hub-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.token',
        '*.refreshToken',
      ],
      censor: '[redigido]',
    },
  });
}

export type { Logger };
