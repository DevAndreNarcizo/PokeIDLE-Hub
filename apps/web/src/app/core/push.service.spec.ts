import { TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { BehaviorSubject } from 'rxjs';
import { ApiClient, ApiError } from './api.client';
import { PanelPush } from './push.service';

describe('PanelPush', () => {
  const subscription$ = new BehaviorSubject<PushSubscription | null>(null);
  const fakeSub = {
    endpoint: 'https://push.exemplo.test/1',
    toJSON: () => ({ endpoint: 'https://push.exemplo.test/1', keys: {} }),
  };
  let api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
  let swPush: {
    isEnabled: boolean;
    subscription: typeof subscription$;
    requestSubscription: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  };

  function setup(enabled = true) {
    api = {
      get: vi.fn().mockResolvedValue({ publicKey: 'BChave' }),
      post: vi.fn().mockResolvedValue(undefined),
    };
    swPush = {
      isEnabled: enabled,
      subscription: subscription$,
      requestSubscription: vi.fn().mockResolvedValue(fakeSub),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: SwPush, useValue: swPush },
        { provide: ApiClient, useValue: api },
      ],
    });
    return TestBed.inject(PanelPush);
  }

  it('sem service worker fica "unsupported"', () => {
    expect(setup(false).state()).toBe('unsupported');
  });

  it('liga: pede a chave, inscreve e registra na API', async () => {
    const push = setup();
    await push.enable();
    expect(swPush.requestSubscription).toHaveBeenCalledWith({ serverPublicKey: 'BChave' });
    expect(api.post).toHaveBeenCalledWith('/push/subscribe', fakeSub.toJSON());
    expect(push.state()).toBe('on');
  });

  it('servidor sem VAPID mostra o motivo', async () => {
    const push = setup();
    api.get.mockRejectedValue(new ApiError(503, 'push_disabled', 'x'));
    await push.enable();
    expect(push.state()).toBe('server_disabled');
  });

  it('desliga: cancela na API e no navegador', async () => {
    const push = setup();
    subscription$.next(fakeSub as unknown as PushSubscription);
    await push.disable();
    expect(api.post).toHaveBeenCalledWith('/push/unsubscribe', { endpoint: fakeSub.endpoint });
    expect(swPush.unsubscribe).toHaveBeenCalled();
    expect(push.state()).toBe('off');
  });
});
