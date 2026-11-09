/**
 * Ambiente da API nos testes E2E. Senha e segredos são fictícios e só valem neste processo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { hashSync } from '@node-rs/argon2';

/** Senha fictícia do painel nos E2E. */
export const E2E_PASSWORD = 'senha-ficticia-e2e-123';

/** Tokens fictícios da ponte por conta. */
export const E2E_BRIDGE_TOKENS = {
  1: 'pih_e2e-ficticio-conta-1',
  2: 'pih_e2e-ficticio-conta-2',
  3: 'pih_e2e-ficticio-conta-3',
  4: 'pih_e2e-ficticio-conta-4',
} as const;

/** URL do banco usado pelos E2E (o mesmo banco descartável dos testes de integração). */
export function e2eDatabaseUrl(): string {
  const url = process.env['TEST_DATABASE_URL'];
  if (!url) {
    throw new Error('Defina TEST_DATABASE_URL (banco descartável e migrado) para rodar os E2E.');
  }
  return url;
}

/** Variáveis de ambiente da API nos E2E. */
export function E2E_ENV(): Record<string, string> {
  return {
    NODE_ENV: 'test',
    PORT: '3100',
    LOG_LEVEL: 'warn',
    CORS_ORIGIN: 'http://127.0.0.1:4300',
    API_PUBLIC_PREFIX: '/api',
    DATABASE_URL: e2eDatabaseUrl(),
    HUB_ADMIN_PASSWORD_HASH: hashSync(E2E_PASSWORD),
    HUB_JWT_SECRET: 'segredo-ficticio-e2e-com-mais-de-32-caracteres',
    LOGIN_RATE_LIMIT_MAX: '100',
  };
}
