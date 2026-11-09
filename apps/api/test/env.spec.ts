import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from '../src/config/env.js';
import { TEST_ENV_VARS } from './helpers.js';

describe('loadEnv', () => {
  it('aceita configuração válida e aplica padrões', () => {
    const env = loadEnv({ ...TEST_ENV_VARS });
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.NODE_ENV).toBe('test');
  });

  it('falha de forma clara listando todas as variáveis ausentes', () => {
    expect(() => loadEnv({})).toThrow(EnvValidationError);
    try {
      loadEnv({});
    } catch (error) {
      const issues = (error as EnvValidationError).issues;
      expect(issues).toContain('CORS_ORIGIN: obrigatória e ausente');
      expect(issues).toContain('DATABASE_URL: obrigatória e ausente');
    }
  });

  it('rejeita porta inválida e banco que não é PostgreSQL', () => {
    expect(() => loadEnv({ ...TEST_ENV_VARS, PORT: '70000' })).toThrow(/PORT/);
    expect(() => loadEnv({ ...TEST_ENV_VARS, DATABASE_URL: 'mysql://x@y/z' })).toThrow(
      /postgresql/,
    );
  });
});
