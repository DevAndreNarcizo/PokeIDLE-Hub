import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { TEST_ENV_VARS, silentLogger } from './helpers.js';

const baseDeps = { env: TEST_ENV_VARS, logger: silentLogger(), version: '0.0.0-test' };

describe('GET /health', () => {
  it('responde 200 quando tudo está saudável', async () => {
    const app = createApp({ ...baseDeps, healthChecks: { database: () => Promise.resolve(true) } });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      version: '0.0.0-test',
      checks: { database: 'ok' },
    });
  });

  it('responde 503 quando uma verificação falha ou lança erro', async () => {
    const app = createApp({
      ...baseDeps,
      healthChecks: { database: () => Promise.reject(new Error('down')) },
    });
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.checks).toEqual({ database: 'fail' });
  });

  it('não expõe o cabeçalho x-powered-by', async () => {
    const res = await request(createApp(baseDeps)).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('rotas desconhecidas e corpo inválido', () => {
  it('responde 404 em JSON', async () => {
    const res = await request(createApp(baseDeps)).get('/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('responde 400 para JSON malformado', async () => {
    const res = await request(createApp(baseDeps))
      .post('/qualquer')
      .set('content-type', 'application/json')
      .send('{malformado');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_body');
  });
});
