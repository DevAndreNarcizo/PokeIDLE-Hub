import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HubStore, emptySyncState } from '../../../core/hub-store';
import { GlobalBar } from './global-bar';

describe('GlobalBar', () => {
  const sync = signal(emptySyncState());
  const autoSync = signal(false);
  const store = {
    sync,
    autoSync,
    syncing: () => sync().status === 'running',
    lastSyncAt: () => sync().finishedAt,
    summary: () => ({ hunting: 2, center: 1, conflict: 1, dailyDone: 4, dailyTotal: 8 }),
    setAutoSync: vi.fn((on: boolean) => autoSync.set(on)),
    syncAll: vi.fn(),
  };

  beforeEach(() => {
    sync.set(emptySyncState());
    autoSync.set(false);
    store.syncAll.mockClear();
    TestBed.configureTestingModule({
      imports: [GlobalBar],
      providers: [{ provide: HubStore, useValue: store }],
    });
  });

  function render(events = [] as { id: string; label: string; detail: string; urgent: boolean }[]) {
    const fixture = TestBed.createComponent(GlobalBar);
    fixture.componentRef.setInput('events', events);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('mostra resumo, eventos e a hora da última sync em Brasília', () => {
    sync.set({ ...emptySyncState(), finishedAt: '2026-11-09T21:56:34Z' });
    const { el } = render([
      { id: 'raid', label: 'Raid Gigantamax', detail: 'Inscrição fecha hoje, 16:00', urgent: true },
    ]);
    expect(el.textContent).toContain('2 caçando');
    expect(el.textContent).toContain('4 / 8');
    expect(el.querySelector('[data-testid="last-sync"]')?.textContent).toBe('18:56:34');
    expect(el.querySelector('.events .urgent')?.textContent).toContain('16:00');
  });

  it('switch Auto alterna aria-checked', () => {
    const { fixture, el } = render();
    const sw = el.querySelector<HTMLButtonElement>('[role="switch"]');
    expect(sw?.getAttribute('aria-checked')).toBe('false');
    sw?.click();
    fixture.detectChanges();
    expect(store.setAutoSync).toHaveBeenCalledWith(true);
    expect(sw?.getAttribute('aria-checked')).toBe('true');
  });

  it('botão sincroniza e fica indisponível durante a rodada', () => {
    const { fixture, el } = render();
    const btn = el.querySelector<HTMLButtonElement>('[data-testid="sync-all"]');
    btn?.click();
    expect(store.syncAll).toHaveBeenCalledOnce();
    sync.set({ ...emptySyncState(), status: 'running' });
    fixture.detectChanges();
    expect(btn?.disabled).toBe(true);
    expect(btn?.textContent).toContain('Sincronizando…');
    expect(btn?.querySelector('.icon')?.classList.contains('spin')).toBe(true);
  });
});
