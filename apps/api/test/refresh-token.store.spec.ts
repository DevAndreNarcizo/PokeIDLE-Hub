import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../src/db/client.js';
import type { PrismaClient } from '../src/db/client.js';
import { PrismaRefreshTokenStore } from '../src/auth/refresh-token.store.js';

// Integração com PostgreSQL: roda só quando TEST_DATABASE_URL aponta para um banco migrado.
const databaseUrl = process.env['TEST_DATABASE_URL'];

describe.skipIf(!databaseUrl)('PrismaRefreshTokenStore (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let store: PrismaRefreshTokenStore;

  beforeAll(async () => {
    prisma = createPrismaClient(databaseUrl ?? '');
    store = new PrismaRefreshTokenStore(prisma);
    await prisma.refreshToken.deleteMany();
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.$disconnect();
  });

  it('cria, encontra e revoga uma única vez', async () => {
    const expiresAt = new Date('2026-12-01T00:00:00Z');
    await store.create({ tokenHash: 'a'.repeat(64), expiresAt });
    expect(await store.find('a'.repeat(64))).toEqual({
      tokenHash: 'a'.repeat(64),
      expiresAt,
      revokedAt: null,
    });
    const at = new Date('2026-11-09T12:00:00Z');
    expect(await store.revoke('a'.repeat(64), at)).toBe(true);
    expect(await store.revoke('a'.repeat(64), at)).toBe(false);
  });

  it('revokeAll revoga os ativos', async () => {
    await store.create({ tokenHash: 'b'.repeat(64), expiresAt: new Date('2026-12-01T00:00:00Z') });
    await store.revokeAll(new Date('2026-11-09T13:00:00Z'));
    expect((await store.find('b'.repeat(64)))?.revokedAt).not.toBeNull();
  });
});
