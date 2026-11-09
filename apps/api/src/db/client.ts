/**
 * Fábrica do Prisma Client com o driver adapter do PostgreSQL (Prisma 7).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Cria um Prisma Client conectado ao banco informado.
 *
 * @param databaseUrl URL `postgresql://` validada pelo env.
 * @returns Cliente Prisma.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

/**
 * Verificação de saúde do banco para `GET /health`.
 *
 * @param prisma Cliente Prisma.
 * @returns `true` se o banco responde.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export async function pingDatabase(prisma: PrismaClient): Promise<boolean> {
  await prisma.$queryRaw`SELECT 1`;
  return true;
}

export type { PrismaClient };
