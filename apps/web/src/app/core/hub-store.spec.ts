import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AccountView } from '@pokeidle-hub/shared';
import { ApiClient } from './api.client';
import { HubSocket } from './hub-socket';
import { HubStore, emptySyncState, summarize } from './hub-store';

function view(
  id: 1 | 2 | 3 | 4,
  status: 'hunting' | 'center' | 'conflict',
  claimed: boolean | null,
  stale = false,
): AccountView {
  return {
    accountId: id,
    label: `Conta ${id}`,
    nick: null,
    receivedAt: '2026-11-09T12:00:00Z',
    stale,
    snapshot: {
      accountId: id,
      capturedAt: '2026-11-09T12:00:00Z',
      source: 'extension',
      status,
      trainerLevel: null,
      hunt: null,
      team: [],
      activePokemon: null,
      session: null,
      inventory: null,
      boosts: [],
      automations: null,
      daily:
        claimed === null
          ? null
          : { battlePassDay: 1, battlePassClaimedToday: claimed, topIdleVotedToday: false },
      seasonalTypeOfDay: null,
    },
  };
}

describe('summarize', () => {
  it('conta estados e pendências conhecidas; ignora contas obsoletas', () => {
    const s = summarize([
      view(1, 'hunting', true),
      view(2, 'hunting', null),
      view(3, 'conflict', false),
      view(4, 'center', true, true),
    ]);
    expect(s).toEqual({ hunting: 2, center: 0, conflict: 1, dailyDone: 1, dailyTotal: 4 });
  });
});

describe('HubStore — Auto 30 s', () => {
  let sent: unknown[];

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sent = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: HubSocket,
          useValue: {
            state: signal('open'),
            retryInMs: signal(null),
            send: (m: unknown) => {
              sent.push(m);
              return true;
            },
            onMessage: () => () => undefined,
            start: () => undefined,
            stop: () => undefined,
          },
        },
        { provide: ApiClient, useValue: {} },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('dispara a cada 30 s com Auto ligado e lembra a escolha', () => {
    const store = TestBed.inject(HubStore);
    store.setAutoSync(true);
    TestBed.tick();
    vi.advanceTimersByTime(30_000);
    vi.advanceTimersByTime(30_000);
    expect(sent).toEqual([
      { v: 1, type: 'sync.all' },
      { v: 1, type: 'sync.all' },
    ]);
    expect(localStorage.getItem('hub.autoSync')).toBe('on');
  });

  it('não dispara com sincronização em andamento', () => {
    const store = TestBed.inject(HubStore);
    store.setAutoSync(true);
    TestBed.tick();
    store.sync.set({ ...emptySyncState(), status: 'running' });
    vi.advanceTimersByTime(90_000);
    expect(sent).toHaveLength(0);
  });

  it('desligado não dispara', () => {
    const store = TestBed.inject(HubStore);
    TestBed.tick();
    vi.advanceTimersByTime(90_000);
    expect(store.autoSync()).toBe(false);
    expect(sent).toHaveLength(0);
  });
});
