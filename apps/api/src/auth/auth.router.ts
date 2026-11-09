/**
 * Rotas de autenticação do painel: login, refresh com rotação, logout e consulta de sessão.
 * Tokens só trafegam em cookies `HttpOnly`, `Secure`, `SameSite=Strict` (ARCHITECTURE.md §9).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Router } from 'express';
import type { CookieOptions, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { HttpError } from '../http/errors.js';
import type { Logger } from '../logger.js';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './cookies.js';
import type { PasswordVerifier } from './password.js';
import type { RefreshTokenStore } from './refresh-token.store.js';
import type { AccessTokenService } from './tokens.js';
import { generateRefreshToken, hashRefreshToken } from './tokens.js';

const loginBodySchema = z.strictObject({ password: z.string().min(1).max(256) });

/**
 * Dependências das rotas de autenticação.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface AuthRouterDeps {
  tokens: AccessTokenService;
  refreshStore: RefreshTokenStore;
  verifyPassword: PasswordVerifier;
  refreshTtlDays: number;
  loginRateLimit: { max: number; windowSeconds: number };
  logger: Logger;
  now?: () => Date;
}

/**
 * Cria o roteador `/auth`.
 *
 * @param deps Dependências injetadas.
 * @returns Roteador Express.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function createAuthRouter(deps: AuthRouterDeps): Router {
  const now = deps.now ?? (() => new Date());
  const router = Router();

  const baseCookie: CookieOptions = { httpOnly: true, secure: true, sameSite: 'strict' };

  /** Emite um novo par de tokens e grava os cookies. */
  const issueSession = async (res: Response): Promise<Date> => {
    const access = await deps.tokens.issue();
    const refresh = generateRefreshToken();
    const refreshExpiresAt = new Date(now().getTime() + deps.refreshTtlDays * 86_400_000);
    await deps.refreshStore.create({
      tokenHash: hashRefreshToken(refresh),
      expiresAt: refreshExpiresAt,
    });
    res.cookie(ACCESS_COOKIE, access.token, {
      ...baseCookie,
      path: '/',
      expires: access.expiresAt,
    });
    res.cookie(REFRESH_COOKIE, refresh, {
      ...baseCookie,
      path: '/auth',
      expires: refreshExpiresAt,
    });
    return access.expiresAt;
  };

  const clearSession = (res: Response): void => {
    res.clearCookie(ACCESS_COOKIE, { ...baseCookie, path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...baseCookie, path: '/auth' });
  };

  const loginLimiter = rateLimit({
    windowMs: deps.loginRateLimit.windowSeconds * 1000,
    limit: deps.loginRateLimit.max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new HttpError(429, 'too_many_attempts', 'Muitas tentativas. Aguarde e tente de novo.'));
    },
  });

  router.post('/auth/login', loginLimiter, async (req, res) => {
    const body = loginBodySchema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'invalid_body', 'Informe a senha');
    }
    if (!(await deps.verifyPassword(body.data.password))) {
      deps.logger.warn({ ip: req.ip }, 'login recusado');
      throw new HttpError(401, 'invalid_credentials', 'Senha incorreta');
    }
    const expiresAt = await issueSession(res);
    res.status(200).json({ accessExpiresAt: expiresAt.toISOString() });
  });

  router.post('/auth/refresh', async (req, res) => {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const presented = cookies?.[REFRESH_COOKIE];
    if (!presented) {
      throw new HttpError(401, 'unauthorized', 'Sessão ausente');
    }
    const tokenHash = hashRefreshToken(presented);
    const record = await deps.refreshStore.find(tokenHash);
    const at = now();
    if (!record || record.expiresAt <= at) {
      clearSession(res);
      throw new HttpError(401, 'unauthorized', 'Sessão expirada');
    }
    // Rotação: um refresh token só vale uma vez. Reuso de token já revogado indica roubo:
    // revoga todas as sessões do dono.
    if (record.revokedAt || !(await deps.refreshStore.revoke(tokenHash, at))) {
      await deps.refreshStore.revokeAll(at);
      deps.logger.warn({ ip: req.ip }, 'reuso de refresh token: todas as sessões revogadas');
      clearSession(res);
      throw new HttpError(401, 'unauthorized', 'Sessão revogada');
    }
    const expiresAt = await issueSession(res);
    res.status(200).json({ accessExpiresAt: expiresAt.toISOString() });
  });

  router.post('/auth/logout', async (req, res) => {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const presented = cookies?.[REFRESH_COOKIE];
    if (presented) {
      await deps.refreshStore.revoke(hashRefreshToken(presented), now());
    }
    clearSession(res);
    res.status(204).end();
  });

  return router;
}
