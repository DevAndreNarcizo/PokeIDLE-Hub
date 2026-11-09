/**
 * Emissão e verificação de tokens do painel. Acesso: JWT HS256 curto (jose). Refresh: valor
 * aleatório opaco, guardado só como hash SHA-256 e rotacionado a cada uso.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { createHash, randomBytes } from 'node:crypto';
import { errors, jwtVerify, SignJWT } from 'jose';

const ISSUER = 'pokeidle-hub';
const AUDIENCE = 'pokeidle-hub-panel';
const OWNER_SUBJECT = 'owner';

/**
 * Resultado da verificação de um token de acesso.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type AccessTokenCheck =
  { ok: true; subject: string } | { ok: false; reason: 'expired' | 'invalid' };

/**
 * Serviço de JWT de acesso.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class AccessTokenService {
  private readonly key: Uint8Array;

  /**
   * @param secret Segredo HMAC (`HUB_JWT_SECRET`).
   * @param ttlSeconds Validade do token.
   * @param now Relógio injetável (testes).
   */
  constructor(
    secret: string,
    private readonly ttlSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  /**
   * Emite um token de acesso para o dono.
   *
   * @returns Token e instante de expiração.
   */
  async issue(): Promise<{ token: string; expiresAt: Date }> {
    const issuedAt = Math.floor(this.now().getTime() / 1000);
    const exp = issuedAt + this.ttlSeconds;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(OWNER_SUBJECT)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(issuedAt)
      .setExpirationTime(exp)
      .sign(this.key);
    return { token, expiresAt: new Date(exp * 1000) };
  }

  /**
   * Verifica assinatura, emissor, audiência e validade.
   *
   * @param token JWT recebido.
   * @returns Sujeito ou o motivo da recusa.
   */
  async verify(token: string): Promise<AccessTokenCheck> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
        currentDate: this.now(),
      });
      return payload.sub ? { ok: true, subject: payload.sub } : { ok: false, reason: 'invalid' };
    } catch (error) {
      return { ok: false, reason: error instanceof errors.JWTExpired ? 'expired' : 'invalid' };
    }
  }
}

/**
 * Gera um refresh token aleatório (256 bits, base64url).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hash SHA-256 do refresh token. O valor em claro nunca é gravado.
 *
 * @param token Refresh token em claro.
 * @returns Hash hexadecimal.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
