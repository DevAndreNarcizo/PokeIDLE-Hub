/**
 * Middleware que exige um token de acesso válido (cookie `hub_at` ou cabeçalho Bearer).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { RequestHandler } from 'express';
import { HttpError } from '../http/errors.js';
import { ACCESS_COOKIE } from './cookies.js';
import type { AccessTokenService } from './tokens.js';

/**
 * Cria o middleware de autenticação do painel.
 *
 * @param tokens Serviço de JWT de acesso.
 * @returns Middleware que responde 401 (`unauthorized` ou `token_expired`).
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function requireAuth(tokens: AccessTokenService): RequestHandler {
  return (req, _res, next) => {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const header = req.get('authorization');
    const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    const token = cookies?.[ACCESS_COOKIE] ?? bearer;
    if (!token) {
      next(new HttpError(401, 'unauthorized', 'Autenticação necessária'));
      return;
    }
    tokens
      .verify(token)
      .then((check) => {
        if (check.ok) {
          next();
        } else if (check.reason === 'expired') {
          next(new HttpError(401, 'token_expired', 'Sessão expirada'));
        } else {
          next(new HttpError(401, 'unauthorized', 'Autenticação necessária'));
        }
      })
      .catch(next);
  };
}
