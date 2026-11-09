/**
 * Script que roda no contexto da página do jogo (`world: MAIN`). Se a extensão "/hunt for
 * PokeIdle" estiver instalada, assina o estado da conta que ela remonta e repassa só o subconjunto
 * usado pelo hub ao content script desta extensão. Não envia nada ao jogo nem altera a página.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { PAGE_BRIDGE_SOURCE, pickHuntState } from './hunt/hunt-state.js';

interface HuntBus {
  on(type: string, fn: (data: unknown) => void): unknown;
}

const MAX_WAIT_MS = 120_000;
const POLL_MS = 1_000;
/** O jogo manda deltas várias vezes por segundo; repassa no máximo a cada 2 s. */
const MIN_INTERVAL_MS = 2_000;

let latest: unknown = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastSent = 0;

function flush(): void {
  timer = null;
  lastSent = Date.now();
  const state = pickHuntState(latest);
  if (state) {
    window.postMessage({ source: PAGE_BRIDGE_SOURCE, type: 'hunt-state', state }, location.origin);
  }
}

function onEstado(estado: unknown): void {
  latest = estado;
  if (timer !== null) return;
  timer = setTimeout(flush, Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastSent)));
}

function attach(started: number): void {
  const bus = (globalThis as { __pokeidleHunt?: Partial<HuntBus> }).__pokeidleHunt;
  if (bus && typeof bus.on === 'function') {
    bus.on('estado', onEstado);
    window.postMessage({ source: PAGE_BRIDGE_SOURCE, type: 'hunt-available' }, location.origin);
    return;
  }
  if (Date.now() - started < MAX_WAIT_MS) {
    setTimeout(() => attach(started), POLL_MS);
  }
}

attach(Date.now());
