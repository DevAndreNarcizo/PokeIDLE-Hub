/**
 * CORS restrito à origem única do painel, com credenciais (ARCHITECTURE.md §9). Em produção o
 * painel e a API ficam na mesma origem atrás do nginx; isto cobre o desenvolvimento e evita
 * liberar qualquer outra origem.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { RequestHandler } from 'express';

/**
 * Cria o middleware de CORS.
 *
 * @param allowedOrigin Origem exata permitida (`CORS_ORIGIN`).
 * @returns Middleware Express.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function createCors(allowedOrigin: string): RequestHandler {
  const origin = new URL(allowedOrigin).origin;
  return (req, res, next) => {
    res.vary('Origin');
    if (req.get('origin') === origin) {
      res.set({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Max-Age': '600',
      });
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  };
}
