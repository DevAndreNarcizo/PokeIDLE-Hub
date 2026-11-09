import { TestBed } from '@angular/core/testing';
import type { AccountView } from '@pokeidle-hub/shared';
import { AccountPanel } from './account-panel';

// FIXTURE ILUSTRATIVA.
const conflict: AccountView = {
  accountId: 3,
  label: 'Conta 3',
  nick: null,
  receivedAt: '2026-11-09T12:00:00Z',
  stale: false,
  snapshot: {
    accountId: 3,
    capturedAt: '2026-11-09T12:00:00Z',
    source: 'extension',
    status: 'conflict',
    trainerLevel: 5310,
    hunt: null,
    team: [],
    activePokemon: null,
    session: null,
    inventory: null,
    boosts: [],
    automations: null,
    daily: null,
    seasonalTypeOfDay: null,
  },
};

describe('AccountPanel', () => {
  it('renderiza status com texto (não só cor) e o banner de conflito com Jogar aqui', () => {
    const fixture = TestBed.createComponent(AccountPanel);
    fixture.componentRef.setInput('account', conflict);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toBe('Conta 3');
    expect(el.textContent).toContain('Treinador nv 5.310');
    expect(el.querySelector('[data-testid="status"]')?.textContent?.trim()).toBe(
      'Aberta em outro lugar',
    );
    expect(el.querySelector('[data-banner="conflict"]')?.textContent).toContain('Jogar aqui');
  });

  it('Jogar aqui e Abrir/focar emitem o pedido de foco da conta', () => {
    const fixture = TestBed.createComponent(AccountPanel);
    fixture.componentRef.setInput('account', conflict);
    const emitted: number[] = [];
    fixture.componentInstance.focusAccount.subscribe((id) => emitted.push(id));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('[data-banner="conflict"] button')?.click();
    el.querySelector<HTMLButtonElement>('[data-testid="focus-account"]')?.click();
    expect(emitted).toEqual([3, 3]);
  });
});
