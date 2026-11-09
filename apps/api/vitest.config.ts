/**
 * Configuração do Vitest para a API: testes unitários e de integração HTTP em Node.
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
