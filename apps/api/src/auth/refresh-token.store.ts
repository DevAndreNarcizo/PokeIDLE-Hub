/**
 * Persistência dos refresh tokens (só o hash). Interface separada da implementação para que os
 * testes de rota usem memória e a produção use PostgreSQL.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * Registro de refresh token.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface RefreshTokenRecord {
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/**
 * Operações de armazenamento de refresh tokens.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface RefreshTokenStore {
  create(record: { tokenHash: string; expiresAt: Date }): Promise<void>;
  find(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /** Revoga um token se ainda ativo. Retorna `true` se esta chamada o revogou (evita corrida). */
  revoke(tokenHash: string, at: Date): Promise<boolean>;
  revokeAll(at: Date): Promise<void>;
}

/**
 * Implementação em memória (testes e desenvolvimento sem banco).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class InMemoryRefreshTokenStore implements RefreshTokenStore {
  private readonly records = new Map<string, RefreshTokenRecord>();

  /** @inheritdoc */
  create(record: { tokenHash: string; expiresAt: Date }): Promise<void> {
    this.records.set(record.tokenHash, { ...record, revokedAt: null });
    return Promise.resolve();
  }

  /** @inheritdoc */
  find(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const record = this.records.get(tokenHash);
    return Promise.resolve(record ? { ...record } : null);
  }

  /** @inheritdoc */
  revoke(tokenHash: string, at: Date): Promise<boolean> {
    const record = this.records.get(tokenHash);
    if (!record || record.revokedAt) {
      return Promise.resolve(false);
    }
    record.revokedAt = at;
    return Promise.resolve(true);
  }

  /** @inheritdoc */
  revokeAll(at: Date): Promise<void> {
    for (const record of this.records.values()) {
      record.revokedAt ??= at;
    }
    return Promise.resolve();
  }
}

/**
 * Implementação em PostgreSQL via Prisma (tabela `refresh_tokens`).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class PrismaRefreshTokenStore implements RefreshTokenStore {
  /**
   * @param prisma Cliente Prisma.
   */
  constructor(private readonly prisma: PrismaClient) {}

  /** @inheritdoc */
  async create(record: { tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.prisma.refreshToken.create({ data: record });
  }

  /** @inheritdoc */
  async find(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { tokenHash: true, expiresAt: true, revokedAt: true },
    });
  }

  /** @inheritdoc */
  async revoke(tokenHash: string, at: Date): Promise<boolean> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: at },
    });
    return count === 1;
  }

  /** @inheritdoc */
  async revokeAll(at: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { revokedAt: null },
      data: { revokedAt: at },
    });
  }
}
