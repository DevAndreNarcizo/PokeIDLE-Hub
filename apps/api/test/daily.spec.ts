import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AccountSnapshot } from '@pokeidle-hub/shared';
import { DailyRepository } from '../src/daily/daily.repository.js';
import type { PrismaClient } from '../src/db/client.js';
import { TEST_DATABASE_URL, resetDatabase, testPrisma } from './support/db.js';
import { illustrativeSnapshot } from './support/snapshots.js';

const withDaily = (
  accountId: 1 | 2 | 3 | 4,
  capturedAt: string,
  pass: boolean | null,
  vote: boolean | null,
): AccountSnapshot =>
  illustrativeSnapshot(accountId, capturedAt, {
    daily: { battlePassDay: 3, battlePassClaimedToday: pass, topIdleVotedToday: vote },
  });

describe.skipIf(!TEST_DATABASE_URL)('diário por conta (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let daily: DailyRepository;

  beforeAll(() => {
    prisma = testPrisma();
    daily = new DailyRepository(prisma);
  });
  beforeEach(async () => resetDatabase(prisma));
  afterAll(async () => prisma.$disconnect());

  it('registra por dia de Brasília (21:30 BRT de 09/11 ainda é dia 09)', async () => {
    await daily.recordFromSnapshot(withDaily(1, '2026-11-10T00:30:00Z', true, false));
    expect(await daily.dayStatus('2026-11-09')).toEqual({
      '1': { battle_pass: 'done', topidle_vote: 'pending' },
    });
  });

  it('"feito" não volta a pendente no mesmo dia; desconhecido (null) não registra', async () => {
    await daily.recordFromSnapshot(withDaily(1, '2026-11-09T12:00:00Z', true, null));
    await daily.recordFromSnapshot(withDaily(1, '2026-11-09T13:00:00Z', false, null));
    expect(await daily.dayStatus('2026-11-09')).toEqual({ '1': { battle_pass: 'done' } });
  });

  it('lembrete: nada antes do horário; depois, só o que está pendente', async () => {
    await daily.recordFromSnapshot(withDaily(1, '2026-11-09T12:00:00Z', true, false));
    await daily.recordFromSnapshot(withDaily(2, '2026-11-09T12:00:00Z', true, true));
    expect(await daily.pendingAfterReminder(new Date('2026-11-09T20:59:00Z'), '18:00')).toEqual([]); // 17:59
    expect(await daily.pendingAfterReminder(new Date('2026-11-09T21:00:00Z'), '18:00')).toEqual([
      { accountId: 1, day: '2026-11-09', tasks: ['topidle_vote'] },
    ]);
  });

  it('reset às 00:00: no dia seguinte tudo volta a pendente', async () => {
    await daily.recordFromSnapshot(withDaily(2, '2026-11-09T12:00:00Z', true, true));
    const nextEvening = new Date('2026-11-10T22:00:00Z'); // 10/11 19:00 BRT
    expect(await daily.pendingAfterReminder(nextEvening, '18:00')).toEqual([
      { accountId: 2, day: '2026-11-10', tasks: ['battle_pass', 'topidle_vote'] },
    ]);
  });

  it('conta sem diário lido nunca gera lembrete; conflito não registra', async () => {
    await daily.recordFromSnapshot({
      ...withDaily(3, '2026-11-09T12:00:00Z', false, false),
      status: 'conflict',
    });
    expect(await daily.pendingAfterReminder(new Date('2026-11-09T23:00:00Z'), '18:00')).toEqual([]);
  });
});
