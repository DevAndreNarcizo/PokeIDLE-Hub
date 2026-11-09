/**
 * Configuração do Vitest para o pacote compartilhado: testes unitários puros, sem I/O.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    environment: 'node',
  },
});
