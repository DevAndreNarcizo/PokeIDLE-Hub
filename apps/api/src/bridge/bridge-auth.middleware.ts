/**
 * Autenticação da ponte por `Authorization: Bearer <token>`. Anexa a conta do token em
 * `res.locals.bridgeAccountId`.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { RequestHandler } from 'express';
import { HttpError } from '../http/errors.js';
import type { BridgeTokenResolver } from './bridge-token.service.js';

/**
 * Cria o middleware de autenticação da ponte.
 *
 * @param resolver Resolve token → conta.
 * @returns Middleware que responde 401 para token ausente, desconhecido ou revogado.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function requireBridgeToken(resolver: BridgeTokenResolver): RequestHandler {
  return (req, res, next) => {
    const header = req.get('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    if (!token) {
      next(new HttpError(401, 'unauthorized', 'Token da ponte ausente'));
      return;
    }
    resolver
      .resolve(token)
      .then((accountId) => {
        if (accountId === null) {
          next(new HttpError(401, 'unauthorized', 'Token da ponte inválido ou revogado'));
          return;
        }
        res.locals['bridgeAccountId'] = accountId;
        next();
      })
      .catch(next);
  };
}
