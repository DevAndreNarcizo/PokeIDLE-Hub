/**
 * Página de opções: salva endereço do hub e token da conta e mostra o estado da conexão.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { BridgeStatus } from './bridge-client.js';
import { STORAGE_KEYS, parseConfig } from './config.js';

const form = document.querySelector<HTMLFormElement>('#config');
const hubInput = document.querySelector<HTMLInputElement>('#hubUrl');
const tokenInput = document.querySelector<HTMLInputElement>('#token');
const statusBox = document.querySelector<HTMLElement>('#status');

/**
 * Texto em pt-BR para cada estado da ponte.
 *
 * @param status Estado.
 * @returns Descrição.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function describeStatus(status: BridgeStatus | undefined): string {
  switch (status?.state) {
    case 'connected':
      return `Conectado ao hub como Conta ${status.accountId}.`;
    case 'connecting':
      return 'Conectando…';
    case 'auth_failed':
      return 'Token recusado pelo hub. Gere um novo token para esta conta e salve de novo.';
    case 'replaced':
      return 'Outra instância da ponte desta conta assumiu a conexão. Use um perfil do Brave por conta.';
    case 'disconnected':
      return `Sem conexão. Nova tentativa em ${Math.round(status.retryInMs / 1000)} s.`;
    default:
      return 'Ainda não configurado.';
  }
}

async function render(): Promise<void> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.config, STORAGE_KEYS.status]);
  const config = parseConfig(stored[STORAGE_KEYS.config]);
  if (config && hubInput && !hubInput.value) {
    hubInput.value = config.hubUrl;
  }
  if (statusBox) {
    statusBox.textContent = describeStatus(stored[STORAGE_KEYS.status] as BridgeStatus | undefined);
  }
}

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const config = parseConfig({ hubUrl: hubInput?.value.trim(), token: tokenInput?.value.trim() });
  if (!config) {
    if (statusBox) {
      statusBox.textContent =
        'Use um endereço https:// (ou http://localhost) e um token que comece com pih_.';
    }
    return;
  }
  void chrome.storage.local.set({ [STORAGE_KEYS.config]: config }).then(() => {
    if (tokenInput) {
      tokenInput.value = '';
    }
  });
});

chrome.storage.onChanged.addListener(() => void render());
void render();
