/**
 * E2E do PokeIdle Hub (Playwright): sobe a API (porta 3100) contra o banco de teste e o painel
 * (`ng serve`, porta 4300) e roda a suíte em 2560×1080 (ultrawide) e 390×844 (celular).
 * Requer `TEST_DATABASE_URL` (banco descartável e migrado). Dados de teste são ILUSTRATIVOS.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
import { E2E_ENV } from './e2e/support/env';

if (existsSync('.env') && !process.env['CI']) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  timeout: 45_000,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4300',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'ultrawide', use: { viewport: { width: 2560, height: 1080 } } },
    {
      name: 'celular',
      use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    },
  ],
  webServer: [
    {
      command: 'node apps/api/dist/server.js',
      url: 'http://localhost:3100/health',
      env: E2E_ENV(),
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npx ng serve --host 127.0.0.1 --port 4300 --proxy-config ../../e2e/proxy.e2e.json',
      cwd: 'apps/web',
      // O Angular CLI dá preferência à variável PORT (que vem do .env da API).
      env: { PORT: '4300' },
      url: 'http://127.0.0.1:4300',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
