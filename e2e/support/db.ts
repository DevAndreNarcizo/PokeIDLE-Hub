/**
 * Preparação do banco nos E2E: zera as tabelas, recria as 4 contas e grava o hash dos tokens
 * fictícios da ponte.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { createHash } from 'node:crypto';
import pg from 'pg';
import { E2E_BRIDGE_TOKENS, e2eDatabaseUrl } from './env';

/** Banco limpo com as 4 contas e tokens da ponte. */
export async function resetE2eDatabase(): Promise<void> {
  const client = new pg.Client({ connectionString: e2eDatabaseUrl() });
  await client.connect();
  try {
    await client.query(
      'TRUNCATE snapshots, account_state, alerts, daily_tasks, hunt_observations, refresh_tokens, push_subscriptions, accounts RESTART IDENTITY CASCADE',
    );
    for (const [id, token] of Object.entries(E2E_BRIDGE_TOKENS)) {
      const hash = createHash('sha256').update(token).digest('hex');
      await client.query(
        'INSERT INTO accounts (id, label, bridge_token_hash) VALUES ($1, $2, $3)',
        [Number(id), `Conta ${id}`, hash],
      );
    }
  } finally {
    await client.end();
  }
}
