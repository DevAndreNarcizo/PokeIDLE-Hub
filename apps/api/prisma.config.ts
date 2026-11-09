/**
 * Configuração do Prisma CLI (Prisma 7): schema, migrações, seed e URL do banco. Carrega o
 * `.env` da raiz do monorepo quando existir.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

const rootEnv = new URL('../../.env', import.meta.url);
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
