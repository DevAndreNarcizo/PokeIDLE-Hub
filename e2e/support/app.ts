/**
 * Passos comuns da interface nos E2E.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { E2E_PASSWORD } from './env';

/** Entra no painel e espera as contas carregarem. */
export async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Senha do painel').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByTestId('account-panel').first()).toBeVisible();
}

/** Layout de celular? */
export function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 820;
}

/** Painel da conta (no celular, seleciona a aba antes). */
export async function accountPanel(page: Page, id: 1 | 2 | 3 | 4): Promise<Locator> {
  if (isMobile(page)) {
    await page.getByRole('tab', { name: new RegExp(`Conta ${id}`) }).click();
  }
  return page
    .getByTestId('account-panel')
    .filter({ has: page.getByRole('heading', { name: `Conta ${id}` }) });
}
