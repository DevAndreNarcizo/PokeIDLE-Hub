/**
 * Leitura do estado da conta entregue pela extensão "/hunt for PokeIdle" (de terceiro, instalada
 * pelo dono): ela escuta o WebSocket do jogo, remonta o estado e o expõe em `window.__pokeidleHunt`
 * (`on('estado', fn)`). Aqui só ficam os campos cujo significado foi conferido no código dela
 * (versão 1.0.17, docs/spikes/S0.2.md). O resto é desconhecido e não é preenchido.
 *
 * TODO(game-data): automações (revive, poções, voltar à hunt), diário, contadores da sessão e hunt
 * atual dependem de uma amostra real do estado (OPEN_QUESTIONS.md #12).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountSnapshot } from '@pokeidle-hub/shared';

/** Identificador das mensagens entre o script da página e o content script. */
export const PAGE_BRIDGE_SOURCE = 'pokeidle-hub-bridge';

/**
 * Subconjunto do estado repassado pela página (nada além disso sai da aba).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface HuntState {
  level: number | null;
  active: {
    nome: unknown;
    level: unknown;
    tipos: unknown;
    potencia: unknown;
    quality: unknown;
    ivs: unknown;
    stats: unknown;
    shiny: unknown;
  } | null;
  balls: unknown;
  boosts: unknown;
  seasonalType: unknown;
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Extrai do estado bruto da /hunt só os campos usados pelo hub. Roda dentro da página.
 *
 * @param estado Estado remontado pela /hunt (`eu`).
 * @returns Subconjunto, ou `null` se não parecer um estado de conta.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function pickHuntState(estado: unknown): HuntState | null {
  if (!isObj(estado)) return null;
  const pokemons = Array.isArray(estado['pokemons']) ? (estado['pokemons'] as unknown[]) : [];
  const ativo = pokemons.find((p) => isObj(p) && p['id'] === estado['activeId']);
  const loja = isObj(estado['loja']) ? estado['loja'] : null;
  const sazonal = isObj(estado['diaSazonal']) ? estado['diaSazonal'] : null;
  return {
    level: num(estado['level']),
    active: isObj(ativo)
      ? {
          nome: ativo['nome'],
          level: ativo['level'],
          tipos: ativo['tipos'],
          potencia: ativo['potencia'],
          quality: ativo['quality'] ?? ativo['qualidade'],
          ivs: ativo['ivs'],
          stats: ativo['stats'],
          shiny: ativo['shiny'],
        }
      : null,
    balls: estado['balls'] ?? null,
    boosts: loja?.['boosts'] ?? null,
    seasonalType: sazonal?.['tipo'] ?? null,
  };
}

const STAT_KEYS: [keyof NonNullable<AccountSnapshot['activePokemon']>['stats'], string][] = [
  ['hp', 'hp'],
  ['atk', 'atk'],
  ['def', 'def'],
  ['spAtk', 'spAtk'],
  ['spDef', 'spDef'],
  ['spd', 'speed'],
];

/** Nomes dos boosts da loja (chaves do jogo → nomes do GAME_RULES.md §5, §7 e §8). */
const BOOST_NAMES: Readonly<Record<string, string>> = {
  xp: 'XP Boost',
  captura: 'Capture Boost',
  loot: 'Loot Boost',
};

function sixStats(raw: unknown): NonNullable<AccountSnapshot['activePokemon']>['stats'] | null {
  if (!isObj(raw)) return null;
  const out = {} as NonNullable<AccountSnapshot['activePokemon']>['stats'];
  for (const [ours, theirs] of STAT_KEYS) {
    const v = num(raw[theirs]);
    if (v === null || v < 0) return null;
    out[ours] = Math.round(v);
  }
  return out;
}

function titleCase(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

/**
 * Campos do snapshot que vêm do estado da /hunt. Sem valor confiável, o campo fica de fora (o
 * leitor mantém o que veio da tela ou `null`).
 *
 * @param state Subconjunto repassado pela página.
 * @param now Agora (boosts vencidos são descartados).
 * @returns Campos parciais do snapshot.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function snapshotFieldsFromHunt(state: HuntState, now: Date): Partial<AccountSnapshot> {
  const fields: Partial<AccountSnapshot> = {};
  if (state.level !== null && Number.isInteger(state.level) && state.level > 0) {
    fields.trainerLevel = state.level;
  }

  const a = state.active;
  if (a) {
    const ivs = sixStats(a.ivs);
    const stats = sixStats(a.stats);
    const types = Array.isArray(a.tipos)
      ? a.tipos.filter((t): t is string => typeof t === 'string' && t.length > 0)
      : [];
    const level = num(a.level);
    const power = num(a.potencia);
    const quality = num(a.quality);
    if (
      typeof a.nome === 'string' &&
      a.nome.length > 0 &&
      level !== null &&
      level > 0 &&
      ivs &&
      stats &&
      types.length >= 1 &&
      types.length <= 2 &&
      power !== null &&
      [1, 2, 3, 4, 5].includes(power) &&
      quality !== null &&
      quality >= 0
    ) {
      fields.activePokemon = {
        species: a.nome.slice(0, 64),
        level: Math.round(level),
        types: types.map(titleCase),
        power: power as 1 | 2 | 3 | 4 | 5,
        quality,
        ivs,
        stats,
        shiny: typeof a.shiny === 'boolean' ? a.shiny : null,
      };
    }
  }

  if (isObj(state.balls)) {
    const balls: Record<string, number> = {};
    for (const [id, count] of Object.entries(state.balls)) {
      const n = num(count);
      if (n !== null && n >= 0 && id.length <= 32) balls[id] = Math.floor(n);
    }
    // Revives, poções e Boss Token não vêm daqui: ficam desconhecidos.
    fields.inventory = { bronzeBossToken: null, potions: null, revives: null, balls };
  }

  if (isObj(state.boosts)) {
    const nowMs = now.getTime();
    fields.boosts = Object.entries(state.boosts)
      .map(([key, until]) => ({ key, until: num(until) }))
      .filter((b): b is { key: string; until: number } => b.until !== null && b.until > nowMs)
      .slice(0, 32)
      .map((b) => ({
        kind: (BOOST_NAMES[b.key] ?? b.key).slice(0, 64),
        expiresAt: new Date(b.until).toISOString(),
        note: null,
      }));
  }

  if (typeof state.seasonalType === 'string' && state.seasonalType.length > 0) {
    fields.seasonalTypeOfDay = titleCase(state.seasonalType).slice(0, 32);
  }
  return fields;
}
