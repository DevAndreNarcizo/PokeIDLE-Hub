/**
 * Configuração do Vitest da extensão: o leitor de tela roda em jsdom.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    environment: 'jsdom',
  },
});
