import { createECDH, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { Agent, createServer } from 'node:https';
import type { Server } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import webpush from 'web-push';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { InMemoryRefreshTokenStore } from '../src/auth/refresh-token.store.js';
import { AccessTokenService } from '../src/auth/tokens.js';
import type { PrismaClient } from '../src/db/client.js';
import type { PushSender, PushSubscriptionInput } from '../src/push/push.service.js';
import { PushService, buildPayload } from '../src/push/push.service.js';
import { WebPushSender } from '../src/push/web-push.sender.js';
import { TEST_DATABASE_URL, resetDatabase, testPrisma } from './support/db.js';
import { TEST_ENV_VARS, silentLogger } from './helpers.js';

// http_ece é dependência do web-push; usado aqui só para decifrar o que o "serviço de push" recebeu.
import * as ece from 'http_ece';

const alert = {
  id: '7',
  accountId: 2 as const,
  kind: 'team_down' as const,
  openedAt: '2026-11-09T12:00:00Z',
  resolvedAt: null,
  ackedAt: null,
  payload: {},
};

class FakeSender implements PushSender {
  sent: { endpoint: string; payload: string }[] = [];
  failWith = new Map<string, number>();
  send(sub: PushSubscriptionInput, payload: string): Promise<void> {
    const status = this.failWith.get(sub.endpoint);
    if (status) return Promise.reject(Object.assign(new Error('falha'), { statusCode: status }));
    this.sent.push({ endpoint: sub.endpoint, payload });
    return Promise.resolve();
  }
}

const sub = (n: number): PushSubscriptionInput => ({
  endpoint: `https://push.exemplo.test/${n}`,
  keys: { p256dh: 'BFicticio' + 'x'.repeat(70), auth: 'auth-ficticio' },
});

describe('payload de push', () => {
  it('segue o formato do service worker do Angular', () => {
    const payload = JSON.parse(buildPayload('T', 'Corpo', 'tag')) as {
      notification: Record<string, unknown>;
    };
    expect(payload.notification).toMatchObject({
      title: 'T',
      body: 'Corpo',
      tag: 'tag',
      lang: 'pt-BR',
    });
    expect(payload.notification['data']).toEqual({
      onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url: '/' } },
    });
  });
});

describe.skipIf(!TEST_DATABASE_URL)('PushService (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let sender: FakeSender;
  let push: PushService;

  beforeAll(() => {
    prisma = testPrisma();
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
    sender = new FakeSender();
    push = new PushService(prisma, sender, silentLogger());
  });
  afterAll(async () => prisma.$disconnect());

  it('inscrição é idempotente por endpoint e o alerta chega a todos os aparelhos', async () => {
    await push.subscribe(sub(1), 'celular');
    await push.subscribe(sub(1), 'celular');
    await push.subscribe(sub(2), 'desktop');
    const result = await push.notifyAlert(alert, 'Conta 2');
    expect(result).toEqual({ sent: 2, removed: 0, failed: 0 });
    const body = JSON.parse(sender.sent[0]?.payload ?? '{}') as {
      notification: { title: string; body: string };
    };
    expect(body.notification).toMatchObject({ title: 'PokeIdle Hub · Conta 2', body: 'Time caiu' });
  });

  it('remove inscrição expirada (410/404) e mantém as outras', async () => {
    await push.subscribe(sub(1), null);
    await push.subscribe(sub(2), null);
    sender.failWith.set(sub(1).endpoint, 410);
    expect(await push.sendTest()).toEqual({ sent: 1, removed: 1, failed: 0 });
    expect(await prisma.pushSubscription.count()).toBe(1);
  });

  it('rotas: desativado sem VAPID (503), validação e inscrição', async () => {
    const tokens = new AccessTokenService('segredo-de-teste-com-mais-de-32-caracteres', 900);
    const bearer = `Bearer ${(await tokens.issue()).token}`;
    const auth = {
      tokens,
      refreshStore: new InMemoryRefreshTokenStore(),
      verifyPassword: () => Promise.resolve(false),
      refreshTtlDays: 30,
      loginRateLimit: { max: 5, windowSeconds: 60 },
    };
    const base = { env: TEST_ENV_VARS, logger: silentLogger(), version: 'test', auth };
    const off = createApp({ ...base, push: { service: null, publicKey: null } });
    expect((await request(off).get('/push/public-key').set('Authorization', bearer)).status).toBe(
      503,
    );

    const on = createApp({ ...base, push: { service: push, publicKey: 'BChavePublicaFicticia' } });
    expect(
      (await request(on).get('/push/public-key').set('Authorization', bearer)).body.publicKey,
    ).toBe('BChavePublicaFicticia');
    const http = { ...sub(3), endpoint: 'http://inseguro.test/x' };
    expect(
      (await request(on).post('/push/subscribe').set('Authorization', bearer).send(http)).status,
    ).toBe(400);
    expect(
      (await request(on).post('/push/subscribe').set('Authorization', bearer).send(sub(3))).status,
    ).toBe(201);
    expect((await request(on).post('/push/test').set('Authorization', bearer)).body).toEqual({
      sent: 1,
      removed: 0,
      failed: 0,
    });
    expect((await request(on).post('/push/subscribe').send(sub(4))).status).toBe(401);
  });
});

describe('WebPushSender ponta a ponta (serviço de push local)', () => {
  let server: Server;
  let received: { headers: Record<string, unknown>; body: Buffer }[];

  beforeAll(async () => {
    // Certificado autoassinado descartável para o "serviço de push" local.
    const dir = mkdtempSync(join(tmpdir(), 'push-'));
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'ec',
        '-pkeyopt',
        'ec_paramgen_curve:prime256v1',
        '-nodes',
        '-keyout',
        join(dir, 'key.pem'),
        '-out',
        join(dir, 'cert.pem'),
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
      ],
      { stdio: 'ignore' },
    );
    received = [];
    server = createServer(
      { key: readFileSync(join(dir, 'key.pem')), cert: readFileSync(join(dir, 'cert.pem')) },
      (req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          received.push({ headers: req.headers, body: Buffer.concat(chunks) });
          res.writeHead(201).end();
        });
      },
    );
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
  });

  afterAll(() => server.close());

  it('cifra com VAPID e o aparelho consegue decifrar a notificação', async () => {
    const browserKeys = createECDH('prime256v1');
    browserKeys.generateKeys();
    const authSecret = randomBytes(16);
    const { port } = server.address() as AddressInfo;
    const vapid = webpush.generateVAPIDKeys();
    const sender = new WebPushSender(
      { ...vapid, subject: 'https://hub.exemplo.test' },
      new Agent({ rejectUnauthorized: false }),
    );
    const payload = buildPayload('PokeIdle Hub · Conta 1', 'Time caiu', 'alert-team_down-1');
    await sender.send(
      {
        endpoint: `https://127.0.0.1:${port}/push/abc`,
        keys: {
          p256dh: browserKeys.getPublicKey().toString('base64url'),
          auth: authSecret.toString('base64url'),
        },
      },
      payload,
    );
    const [msg] = received;
    expect(msg?.headers['authorization']).toMatch(/^vapid t=.+, k=/);
    expect(msg?.headers['content-encoding']).toBe('aes128gcm');
    expect(msg?.headers['urgency']).toBe('high');
    const plain = ece.decrypt(msg?.body ?? Buffer.alloc(0), {
      version: 'aes128gcm',
      privateKey: browserKeys,
      authSecret,
    });
    expect(plain.toString('utf8')).toBe(payload);
  });
});
