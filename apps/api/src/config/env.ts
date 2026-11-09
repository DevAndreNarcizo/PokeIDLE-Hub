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
  /** Conexão PostgreSQL usada pelo Prisma. */
  DATABASE_URL: z
    .url()
    .refine((v) => /^postgres(ql)?:\/\//.test(v), 'deve ser uma URL postgresql://'),
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
