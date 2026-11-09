/**
 * Leitura e validação das variáveis de ambiente com zod. A API não sobe com configuração
 * inválida: o erro lista todas as variáveis com problema de uma vez.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Origem única do painel liberada no CORS (ARCHITECTURE.md §9). */
  CORS_ORIGIN: z.url(),
  /** Prefixo público da API no navegador (ex.: `/api`); define o caminho do cookie de refresh. */
  API_PUBLIC_PREFIX: z
    .string()
    .regex(/^(\/[a-z0-9-]+)*$/, 'use vazio ou algo como /api')
    .default(''),
  /** Conexão PostgreSQL usada pelo Prisma. */
  DATABASE_URL: z
    .url()
    .refine((v) => /^postgres(ql)?:\/\//.test(v), 'deve ser uma URL postgresql://'),
  /** Hash argon2 da senha do painel (gere com `npm run hash-password -w @pokeidle-hub/api`). */
  HUB_ADMIN_PASSWORD_HASH: z.string().startsWith('$argon2', 'deve ser um hash argon2'),
  /** Segredo HMAC dos JWT de acesso (mínimo 32 caracteres aleatórios). */
  HUB_JWT_SECRET: z.string().min(32, 'mínimo de 32 caracteres'),
  /** Validade do token de acesso (ARCHITECTURE.md §9: 15 min). */
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
  /** Validade do refresh token. */
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  /** Tentativas de login permitidas por IP na janela. */
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100).default(5),
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(10).max(86_400).default(900),
  /** Snapshots aceitos por conta por minuto em `POST /ingest/snapshot`. */
  INGEST_RATE_PER_MINUTE: z.coerce.number().int().min(1).max(600).default(60),
  /** Dias de histórico de snapshots mantidos (ARCHITECTURE.md §6). */
  SNAPSHOT_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
});

/**
 * Configuração validada da API.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Erro de configuração com a lista legível dos problemas encontrados.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class EnvValidationError extends Error {
  /**
   * @param issues Problemas no formato `VARIAVEL: mensagem`.
   */
  constructor(readonly issues: readonly string[]) {
    super(`Configuração inválida:\n  - ${issues.join('\n  - ')}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Valida as variáveis de ambiente.
 *
 * @param source Variáveis a validar (padrão: `process.env`).
 * @returns Configuração tipada.
 * @throws EnvValidationError quando alguma variável falta ou é inválida.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const name = issue.path.join('.');
      const missing = source[name] === undefined || source[name] === '';
      return `${name}: ${missing ? 'obrigatória e ausente' : issue.message}`;
    });
    throw new EnvValidationError(issues);
  }
  return result.data;
}
