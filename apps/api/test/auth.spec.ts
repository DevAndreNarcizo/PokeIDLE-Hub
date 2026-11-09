import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createArgon2Verifier, hashPassword } from '../src/auth/password.js';
import { InMemoryRefreshTokenStore } from '../src/auth/refresh-token.store.js';
import { AccessTokenService } from '../src/auth/tokens.js';
import { TEST_ENV_VARS, silentLogger } from './helpers.js';

// Senha e segredo fictícios, só para teste.
const PASSWORD = 'senha-de-teste-123';
const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

interface Harness {
  app: ReturnType<typeof createApp>;
  clock: { now: Date };
  store: InMemoryRefreshTokenStore;
}

function buildApp(rateLimitMax = 5): Harness {
  const clock = { now: new Date('2026-11-09T12:00:00Z') };
  const now = (): Date => clock.now;
  const store = new InMemoryRefreshTokenStore();
  const app = createApp({
    env: TEST_ENV_VARS,
    logger: silentLogger(),
    version: 'test',
    auth: {
      tokens: new AccessTokenService(SECRET, 900, now),
      refreshStore: store,
      verifyPassword: createArgon2Verifier(passwordHash),
      refreshTtlDays: 30,
      loginRateLimit: { max: rateLimitMax, windowSeconds: 900 },
      now,
    },
  });
  return { app, clock, store };
}

/** Extrai `nome=valor` dos cabeçalhos Set-Cookie (cookies Secure não são reenviados em http). */
function cookieValue(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const found = raw?.find((c) => c.startsWith(`${name}=`));
  return found?.split(';')[0]?.slice(name.length + 1);
}

async function login(
  app: Harness['app'],
): Promise<{ access: string; refresh: string; res: request.Response }> {
  const res = await request(app).post('/auth/login').send({ password: PASSWORD });
  return {
    access: cookieValue(res, 'hub_at') ?? '',
    refresh: cookieValue(res, 'hub_rt') ?? '',
    res,
  };
}

describe('POST /auth/login', () => {
  let h: Harness;
  beforeEach(() => {
    h = buildApp();
  });

  it('aceita a senha correta e grava cookies seguros', async () => {
    const { res, access, refresh } = await login(h.app);
    expect(res.status).toBe(200);
    expect(res.body.accessExpiresAt).toBe('2026-11-09T12:15:00.000Z');
    expect(access).not.toBe('');
    expect(refresh).not.toBe('');
    const cookies = (res.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(cookies).toMatch(/hub_at=.*HttpOnly.*Secure.*SameSite=Strict/);
    expect(cookies).toMatch(/hub_rt=.*Path=\/auth.*HttpOnly.*Secure.*SameSite=Strict/);
  });

  it('recusa senha errada com 401 sem emitir cookies', async () => {
    const res = await request(h.app).post('/auth/login').send({ password: 'errada' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('invalid_credentials');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('recusa corpo sem senha com 400', async () => {
    const res = await request(h.app).post('/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('aplica rate limit após o máximo de tentativas', async () => {
    const limited = buildApp(3);
    for (let i = 0; i < 3; i++) {
      expect((await request(limited.app).post('/auth/login').send({ password: 'x' })).status).toBe(
        401,
      );
    }
    const blocked = await request(limited.app).post('/auth/login').send({ password: PASSWORD });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('too_many_attempts');
  });
});

describe('GET /auth/session (rota protegida)', () => {
  it('exige autenticação', async () => {
    const res = await request(buildApp().app).get('/auth/session');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('aceita o token de acesso por cookie e por Bearer', async () => {
    const h = buildApp();
    const { access } = await login(h.app);
    expect(
      (await request(h.app).get('/auth/session').set('Cookie', `hub_at=${access}`)).status,
    ).toBe(200);
    expect(
      (await request(h.app).get('/auth/session').set('Authorization', `Bearer ${access}`)).status,
    ).toBe(200);
  });

  it('responde token_expired depois de 15 minutos', async () => {
    const h = buildApp();
    const { access } = await login(h.app);
    h.clock.now = new Date('2026-11-09T12:15:01Z');
    const res = await request(h.app).get('/auth/session').set('Cookie', `hub_at=${access}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('token_expired');
  });

  it('recusa token adulterado ou assinado com outro segredo', async () => {
    const h = buildApp();
    const { access } = await login(h.app);
    const forged = await new AccessTokenService(
      'outro-segredo-com-mais-de-32-caracteres!!',
      900,
    ).issue();
    for (const token of [`${access}x`, forged.token]) {
      const res = await request(h.app).get('/auth/session').set('Cookie', `hub_at=${token}`);
      expect(res.body.error.code).toBe('unauthorized');
    }
  });
});

describe('POST /auth/refresh', () => {
  it('rotaciona o refresh token e emite novo acesso', async () => {
    const h = buildApp();
    const first = await login(h.app);
    h.clock.now = new Date('2026-11-09T12:20:00Z');
    const res = await request(h.app).post('/auth/refresh').set('Cookie', `hub_rt=${first.refresh}`);
    expect(res.status).toBe(200);
    const rotated = cookieValue(res, 'hub_rt');
    expect(rotated).toBeDefined();
    expect(rotated).not.toBe(first.refresh);
    const access = cookieValue(res, 'hub_at') ?? '';
    expect(
      (await request(h.app).get('/auth/session').set('Cookie', `hub_at=${access}`)).status,
    ).toBe(200);
  });

  it('reuso de refresh token já usado revoga todas as sessões', async () => {
    const h = buildApp();
    const first = await login(h.app);
    const rotated = cookieValue(
      await request(h.app).post('/auth/refresh').set('Cookie', `hub_rt=${first.refresh}`),
      'hub_rt',
    );
    const reuse = await request(h.app)
      .post('/auth/refresh')
      .set('Cookie', `hub_rt=${first.refresh}`);
    expect(reuse.status).toBe(401);
    // O token legítimo, emitido na rotação, também deixa de valer.
    const afterTheft = await request(h.app)
      .post('/auth/refresh')
      .set('Cookie', `hub_rt=${rotated}`);
    expect(afterTheft.status).toBe(401);
  });

  it('recusa refresh ausente, desconhecido ou expirado', async () => {
    const h = buildApp();
    expect((await request(h.app).post('/auth/refresh')).status).toBe(401);
    expect(
      (await request(h.app).post('/auth/refresh').set('Cookie', 'hub_rt=desconhecido')).status,
    ).toBe(401);
    const { refresh } = await login(h.app);
    h.clock.now = new Date('2026-12-09T12:00:01Z'); // 30 dias depois
    expect(
      (await request(h.app).post('/auth/refresh').set('Cookie', `hub_rt=${refresh}`)).status,
    ).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revoga o refresh token e limpa os cookies', async () => {
    const h = buildApp();
    const { refresh } = await login(h.app);
    const res = await request(h.app).post('/auth/logout').set('Cookie', `hub_rt=${refresh}`);
    expect(res.status).toBe(204);
    expect((res.headers['set-cookie'] as unknown as string[]).join('\n')).toMatch(/hub_at=;/);
    expect(
      (await request(h.app).post('/auth/refresh').set('Cookie', `hub_rt=${refresh}`)).status,
    ).toBe(401);
  });
});
