import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BridgeTokenService } from '../src/bridge/bridge-token.service.js';
import type { PrismaClient } from '../src/db/client.js';
import { TEST_DATABASE_URL, resetDatabase, testPrisma } from './support/db.js';

describe.skipIf(!TEST_DATABASE_URL)('BridgeTokenService (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let service: BridgeTokenService;

  beforeAll(() => {
    prisma = testPrisma();
    service = new BridgeTokenService(prisma);
  });
  beforeEach(async () => resetDatabase(prisma));
  afterAll(async () => prisma.$disconnect());

  it('emite token que resolve para a conta e guarda só o hash', async () => {
    const token = await service.issue(3);
    expect(token).toMatch(/^pih_/);
    expect(await service.resolve(token)).toBe(3);
    const row = await prisma.account.findUniqueOrThrow({ where: { id: 3 } });
    expect(row.bridgeTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.bridgeTokenHash).not.toContain(token);
  });

  it('reemissão invalida o token anterior', async () => {
    const old = await service.issue(1);
    const fresh = await service.issue(1);
    expect(await service.resolve(old)).toBeNull();
    expect(await service.resolve(fresh)).toBe(1);
  });

  it('revogação invalida o token', async () => {
    const token = await service.issue(2);
    await service.revoke(2);
    expect(await service.resolve(token)).toBeNull();
  });

  it('não resolve token com formato errado', async () => {
    expect(await service.resolve('sem-prefixo')).toBeNull();
  });
});
