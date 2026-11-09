/**
 * E2E do painel (F3-T6): sincronização manual, Auto 30 s, abas no celular e estado de conflito.
 * Rodam em 2560×1080 e 390×844. Pontes simuladas no lugar da extensão; dados ILUSTRATIVOS.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { expect, test } from '@playwright/test';
import { accountPanel, isMobile, login } from './support/app';
import { resetE2eDatabase } from './support/db';
import { FakeBridge } from './support/fake-bridge';

let bridges: FakeBridge[] = [];

test.beforeEach(async () => {
  await resetE2eDatabase();
  // Contas 1 e 2 caçando, 3 aberta em outro lugar; conta 4 sem ponte.
  bridges = [
    new FakeBridge(1, 'hunting'),
    new FakeBridge(2, 'hunting'),
    new FakeBridge(3, 'conflict'),
  ];
  await Promise.all(bridges.map((b) => b.connect()));
});

test.afterEach(() => bridges.forEach((b) => b.close()));

test('Sincronizar tudo atualiza as contas e marca a sem ponte como desatualizada', async ({
  page,
}) => {
  await login(page);
  const syncButton = page.getByTestId('sync-all');
  await syncButton.click();
  await expect(syncButton).toBeEnabled({ timeout: 15_000 });

  const one = await accountPanel(page, 1);
  await expect(one.getByTestId('status')).toHaveText('Caçando');
  await expect(one).toContainText(/2,1\s?mi/);

  const four = await accountPanel(page, 4);
  await expect(four.getByTestId('status')).toHaveText('Desatualizado');

  if (!isMobile(page)) {
    await expect(page.getByTestId('last-sync')).not.toHaveText('—');
    await expect(page.getByText('2 caçando')).toBeVisible();
  }
  expect(bridges.every((b) => b.count('sync.request') === 1)).toBe(true);
});

test('Auto 30 s dispara sozinho a cada 30 s', async ({ page }) => {
  await page.clock.install();
  await login(page);
  const auto = page.getByRole('switch', { name: 'Auto 30 s' });
  await auto.click();
  await expect(auto).toHaveAttribute('aria-checked', 'true');
  await page.clock.runFor(30_000);
  await expect.poll(() => bridges[0]?.count('sync.request')).toBe(1);
  await page.clock.runFor(30_000);
  await expect.poll(() => bridges[0]?.count('sync.request')).toBe(2);
});

test('estado de conflito: banner, métricas vazias e Jogar aqui foca a janela da conta', async ({
  page,
}) => {
  await login(page);
  await page.getByTestId('sync-all').click();
  const three = await accountPanel(page, 3);
  await expect(three.getByTestId('status')).toHaveText('Aberta em outro lugar');
  const banner = three.locator('[data-banner="conflict"]');
  await expect(banner).toContainText('Conta aberta em outro lugar');
  await expect(three.locator('.metric dd').first()).toHaveText('—');
  await banner.getByRole('button', { name: 'Jogar aqui' }).click();
  await expect.poll(() => bridges[2]?.count('focus')).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: 'janela do jogo' })).toBeVisible();
});

test('celular: abas por conta com teclado e aria-selected', async ({ page }) => {
  test.skip(!isMobile(page), 'abas só existem no layout de celular');
  await login(page);
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(4);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  for (const tab of await tabs.all()) {
    const box = await tab.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(page.getByRole('tabpanel').getByRole('heading', { name: 'Conta 2' })).toBeVisible();
  await page.keyboard.press('End');
  await expect(tabs.nth(3)).toHaveAttribute('aria-selected', 'true');
});

test('ultrawide: grid 2×2 sem rolagem horizontal', async ({ page }) => {
  test.skip(isMobile(page), 'grid só existe no desktop');
  await login(page);
  const panels = page.getByTestId('account-panel');
  await expect(panels).toHaveCount(4);
  const boxes = await Promise.all((await panels.all()).map((p) => p.boundingBox()));
  expect(boxes[0]?.y).toBe(boxes[1]?.y);
  expect(boxes[2]?.x).toBe(boxes[0]?.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/visual/ultrawide-2560x1080.png' });
});

test('celular: sem rolagem horizontal', async ({ page }) => {
  test.skip(!isMobile(page), 'só no celular');
  await login(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/visual/celular-390x844.png', fullPage: true });
});
