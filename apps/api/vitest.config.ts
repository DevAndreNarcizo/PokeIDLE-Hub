/**
 * Configuração do Vitest para a API. Carrega o `.env` da raiz (se existir) para obter
 * `TEST_DATABASE_URL`; os testes de integração usam um banco próprio e rodam em série.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const rootEnv = new URL('../../.env', import.meta.url);
if (existsSync(rootEnv) && !process.env['CI']) {
  process.loadEnvFile(rootEnv);
}

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    environment: 'node',
    // Os testes de integração compartilham o mesmo banco: nada de paralelismo entre arquivos.
    fileParallelism: false,
  },
});
