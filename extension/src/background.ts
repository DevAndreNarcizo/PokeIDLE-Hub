/**
 * Service worker da extensão: liga o {@link BridgeClient} às APIs do navegador (WebSocket,
 * `chrome.tabs`, `chrome.storage`, `chrome.alarms`).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountId } from '@pokeidle-hub/shared';
import { BridgeClient } from './bridge-client.js';
import type { BridgeStatus, SocketLike } from './bridge-client.js';
import { STORAGE_KEYS, parseConfig } from './config.js';
import type { ReadRequest } from './messages.js';

const GAME_TAB_PATTERN = 'https://pokeidle.io/app*';
const KEEPALIVE_ALARM = 'bridge-keepalive';

async function readGameTab(accountId: AccountId): Promise<unknown> {
  const tabs = await chrome.tabs.query({ url: GAME_TAB_PATTERN });
  const tab = tabs.find((t) => t.active) ?? tabs[0];
  if (tab?.id === undefined) {
    return null;
  }
  const request: ReadRequest = { type: 'hub.read', accountId };
  return chrome.tabs.sendMessage(tab.id, request);
}

/** Adapta o WebSocket do navegador à interface mínima do cliente. */
function openSocket(url: string): SocketLike {
  const ws = new WebSocket(url);
  const socket: SocketLike = {
    get readyState() {
      return ws.readyState;
    },
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    send: (data) => ws.send(data),
    close: (code, reason) => ws.close(code, reason),
  };
  ws.addEventListener('open', () => socket.onopen?.());
  ws.addEventListener('message', (event: MessageEvent<unknown>) =>
    socket.onmessage?.({ data: event.data }),
  );
  ws.addEventListener('close', (event) => socket.onclose?.({ code: event.code }));
  ws.addEventListener('error', () => socket.onerror?.());
  return socket;
}

const client = new BridgeClient({
  openSocket,
  readGameTab,
  setStatus: (status: BridgeStatus) =>
    void chrome.storage.local.set({ [STORAGE_KEYS.status]: status }),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
  now: () => new Date(),
  version: chrome.runtime.getManifest().version,
});

async function loadConfig(): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.config);
  client.configure(parseConfig(stored[STORAGE_KEYS.config]));
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && STORAGE_KEYS.config in changes) {
    client.configure(parseConfig(changes[STORAGE_KEYS.config]?.newValue));
  }
});

// Se o service worker for suspenso, o alarme o acorda e a conexão é refeita.
void chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    client.ensureConnected();
  }
});

chrome.action.onClicked.addListener(() => void chrome.runtime.openOptionsPage());

void loadConfig();
