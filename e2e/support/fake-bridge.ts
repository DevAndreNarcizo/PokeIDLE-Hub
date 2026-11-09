/**
 * Ponte simulada para os E2E: faz o papel da extensão de uma conta, conectando em `/bridge` e
 * respondendo `sync.request` com um snapshot ILUSTRATIVO (ou ficando em silêncio).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import WebSocket from 'ws';
import { E2E_BRIDGE_TOKENS } from './env';

type AccountId = 1 | 2 | 3 | 4;
type Status = 'hunting' | 'center' | 'conflict' | 'offline' | 'unknown';

/** Snapshot ILUSTRATIVO (valores inventados). */
export function illustrativeSnapshot(
  accountId: AccountId,
  status: Status,
): Record<string, unknown> {
  const live = status === 'hunting';
  return {
    accountId,
    capturedAt: new Date().toISOString(),
    source: 'extension',
    status,
    trainerLevel: [377, 1204, 5310, 150][accountId - 1],
    hunt: live ? { region: 'Johto', level: 350, name: null } : null,
    team: live ? [{ species: 'Ilustrativo', level: 380, hpPct: 100 }] : [],
    activePokemon: null,
    session: live
      ? {
          xpTrainerPerHour: 2_100_000,
          xpPokemonPerHour: 1_900_000,
          kills: 923,
          captures: 6,
          gold: 1000,
          shinySeen: 0,
          shinyCaught: 0,
          rareDrops: {},
        }
      : null,
    inventory: null,
    boosts: [],
    automations: null,
    daily: live
      ? { battlePassDay: 12, battlePassClaimedToday: true, topIdleVotedToday: false }
      : null,
    seasonalTypeOfDay: null,
  };
}

/** Ponte simulada de uma conta. */
export class FakeBridge {
  readonly received: { type: string; requestId?: string }[] = [];
  private socket: WebSocket | null = null;

  constructor(
    readonly accountId: AccountId,
    public status: Status | 'silent',
  ) {}

  /** Conecta e aguarda o `hello.ok`. */
  async connect(): Promise<void> {
    const socket = new WebSocket('ws://localhost:3100/bridge');
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      socket.once('error', reject);
      socket.once('open', () => {
        socket.send(
          JSON.stringify({
            v: 1,
            type: 'hello',
            token: E2E_BRIDGE_TOKENS[this.accountId],
            extensionVersion: 'e2e',
          }),
        );
      });
      socket.on('message', (raw) => {
        const msg = JSON.parse(String(raw)) as { type: string; requestId?: string };
        this.received.push(msg);
        if (msg.type === 'hello.ok') resolve();
        if (msg.type === 'sync.request' && this.status !== 'silent') {
          socket.send(
            JSON.stringify({
              v: 1,
              type: 'snapshot',
              requestId: msg.requestId,
              snapshot: illustrativeSnapshot(this.accountId, this.status),
            }),
          );
        }
      });
    });
  }

  /** Quantos pedidos de cada tipo chegaram. */
  count(type: string): number {
    return this.received.filter((m) => m.type === type).length;
  }

  close(): void {
    this.socket?.close();
  }
}
