/**
 * Tokens da ponte (extensão → API), um por conta (ARCHITECTURE.md §5 e §9): gerados
 * aleatoriamente, mostrados uma única vez, guardados só como hash SHA-256 e revogáveis.
 * O escopo é apenas a ingestão de snapshots da própria conta.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AccountId } from '@pokeidle-hub/shared';
import { accountIdSchema } from '@pokeidle-hub/shared';
import type { PrismaClient } from '../generated/prisma/client.js';

/** Prefixo que identifica tokens da ponte em logs e no gerenciador de senhas. */
const TOKEN_PREFIX = 'pih_';

/**
 * Hash SHA-256 (hex) de um token da ponte.
 *
 * @param token Token em claro.
 * @returns Hash hexadecimal.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function hashBridgeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Resolve, emite e revoga tokens da ponte.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface BridgeTokenResolver {
  /** Conta dona do token, ou `null` se o token não existe ou foi revogado. */
  resolve(token: string): Promise<AccountId | null>;
}

/**
 * Implementação em PostgreSQL (coluna `accounts.bridge_token_hash`).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class BridgeTokenService implements BridgeTokenResolver {
  /**
   * @param prisma Cliente Prisma.
   */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Emite um novo token para a conta, substituindo (e invalidando) o anterior.
   *
   * @param accountId Conta.
   * @returns Token em claro; não é possível recuperá-lo depois.
   */
  async issue(accountId: AccountId): Promise<string> {
    const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    await this.prisma.account.update({
      where: { id: accountId },
      data: { bridgeTokenHash: hashBridgeToken(token) },
    });
    return token;
  }

  /**
   * Revoga o token da conta.
   *
   * @param accountId Conta.
   */
  async revoke(accountId: AccountId): Promise<void> {
    await this.prisma.account.update({ where: { id: accountId }, data: { bridgeTokenHash: null } });
  }

  /** @inheritdoc */
  async resolve(token: string): Promise<AccountId | null> {
    if (!token.startsWith(TOKEN_PREFIX) || token.length > 200) {
      return null;
    }
    const presented = Buffer.from(hashBridgeToken(token), 'hex');
    const accounts = await this.prisma.account.findMany({
      where: { bridgeTokenHash: { not: null } },
      select: { id: true, bridgeTokenHash: true },
    });
    // Comparação em tempo constante contra cada hash (no máximo 4 contas).
    for (const account of accounts) {
      const stored = Buffer.from(account.bridgeTokenHash ?? '', 'hex');
      if (stored.length === presented.length && timingSafeEqual(stored, presented)) {
        const parsed = accountIdSchema.safeParse(account.id);
        return parsed.success ? parsed.data : null;
      }
    }
    return null;
  }
}
