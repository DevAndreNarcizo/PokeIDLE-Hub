/**
 * Leitura e validação da configuração salva em `chrome.storage.local`.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { BridgeConfig } from './bridge-client.js';

/**
 * Chaves do armazenamento local.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const STORAGE_KEYS = { config: 'bridgeConfig', status: 'bridgeStatus' } as const;

/**
 * Valida um valor lido do armazenamento.
 *
 * @param value Valor bruto.
 * @returns Configuração válida ou `null`.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function parseConfig(value: unknown): BridgeConfig | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const { hubUrl, token } = value as Record<string, unknown>;
  if (typeof hubUrl !== 'string' || typeof token !== 'string' || !token.startsWith('pih_')) {
    return null;
  }
  try {
    const url = new URL(hubUrl);
    // HTTPS obrigatório fora do computador local: o token trafega na conexão.
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
      return null;
    }
  } catch {
    return null;
  }
  return { hubUrl, token };
}
