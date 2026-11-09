/**
 * Página de opções: salva endereço do hub e token da conta e mostra o estado da conexão.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { BridgeStatus } from './bridge-client.js';
import { STORAGE_KEYS, parseConfig } from './config.js';
import { describeReader, describeStatus } from './options-text.js';

const form = document.querySelector<HTMLFormElement>('#config');
const hubInput = document.querySelector<HTMLInputElement>('#hubUrl');
const tokenInput = document.querySelector<HTMLInputElement>('#token');
const statusBox = document.querySelector<HTMLElement>('#status');

async function render(): Promise<void> {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.config,
    STORAGE_KEYS.status,
    STORAGE_KEYS.reader,
  ]);
  const config = parseConfig(stored[STORAGE_KEYS.config]);
  if (config && hubInput && !hubInput.value) {
    hubInput.value = config.hubUrl;
  }
  if (statusBox) {
    statusBox.textContent = `${describeStatus(stored[STORAGE_KEYS.status] as BridgeStatus | undefined)} ${describeReader(stored[STORAGE_KEYS.reader])}`;
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
