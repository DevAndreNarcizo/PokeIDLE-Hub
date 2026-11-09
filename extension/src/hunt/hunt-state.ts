/**
 * Leitura do estado da conta entregue pela extensão "/hunt for PokeIdle" (de terceiro, instalada
 * pelo dono): ela escuta o WebSocket do jogo, remonta o estado e o expõe em `window.__pokeidleHunt`
 * (`on('estado', fn)`). Os campos e seus significados foram conferidos numa amostra real do estado
 * (cliente v1.414.1, 09/11/2026; fixture anonimizada em `test/fixtures/estado.real-anon.json`).
 *
 * Inferências documentadas (a confirmar se o jogo mudar):
 * - `passe.ultimo` é o número do dia (dias desde 1970) do último resgate, contado em Brasília
 *   (a virada do jogo é 00:00 de Brasília, GAME_RULES.md §11);
 * - poções e revives são os itens cujos ids estão em `automation.potionIds`/`reviveIds`;
 * - "Voltar à hunt" fica pausada quando está ligada e não há poção nem revive (GAME_RULES.md §9).
 *
 * TODO(game-data): voto TopIdle, Boss Token, raros e shiny da sessão não aparecem no estado.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountSnapshot } from '@pokeidle-hub/shared';
import { KNOWN_HUNT_LEVELS } from '@pokeidle-hub/shared/domain';

/** Identificador das mensagens entre o script da página e o content script. */
export const PAGE_BRIDGE_SOURCE = 'pokeidle-hub-bridge';

/**
 * Pokemon como vem do estado (só os campos usados).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface HuntPokemon {
  id: unknown;
  nome: unknown;
  level: unknown;
  tipos: unknown;
  potencia: unknown;
  quality: unknown;
  ivs: unknown;
  stats: unknown;
  shiny: unknown;
  xp: unknown;
  hp: unknown;
  maxHp: unknown;
  slot: unknown;
}

/**
 * Subconjunto do estado repassado pela página (nada além disso sai da aba).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface HuntState {
  level: number | null;
  xpTotal: number | null;
  noCentro: boolean | null;
  huntSlug: string | null;
  wild: { nome: unknown; level: unknown } | null;
  active: HuntPokemon | null;
  team: HuntPokemon[];
  balls: unknown;
  potions: number | null;
  revives: number | null;
  automation: {
    autoRevive: unknown;
    autoPotion: unknown;
    autoVoltarHunt: unknown;
    autoBallSemParar: unknown;
  } | null;
  pass: { ultimo: unknown; degrau: unknown } | null;
  boosts: { key: string; until: number; note: string | null }[];
  seasonalType: unknown;
  dexKills: number | null;
  dexCaptures: number | null;
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

function pokemonOf(p: Raw): HuntPokemon {
  return {
    id: p['id'],
    nome: p['nome'],
    level: p['level'],
    tipos: p['tipos'],
    potencia: p['potencia'],
    quality: p['quality'] ?? p['qualidade'],
    ivs: p['ivs'],
    stats: p['stats'],
    shiny: p['shiny'],
    xp: p['xp'],
    hp: p['hp'],
    maxHp: p['maxHp'],
    slot: p['slot'],
  };
}

function sumIds(items: unknown, ids: unknown): number | null {
  if (!isObj(items) || !Array.isArray(ids)) return null;
  return ids.reduce<number>((total, id) => total + (num(items[String(id)]) ?? 0), 0);
}

function sumField(dex: unknown, field: 'k' | 'c'): number | null {
  if (!isObj(dex)) return null;
  let total = 0;
  for (const entry of Object.values(dex)) {
    if (isObj(entry)) total += num(entry[field]) ?? 0;
  }
  return total;
}

/** Boosts com prazo: loja, parcelas de bônus de XP, Twitch e Kick. */
function boostsOf(estado: Raw): HuntState['boosts'] {
  const out: HuntState['boosts'] = [];
  const add = (key: string, until: unknown, note: string | null = null) => {
    const u = num(until);
    if (u !== null && u > 0) out.push({ key, until: u, note });
  };
  const loja = isObj(estado['loja']) ? estado['loja'] : null;
  if (isObj(loja?.['boosts'])) {
    for (const [k, v] of Object.entries(loja['boosts'])) add(`loja:${k}`, v);
  }
  const bonus = isObj(estado['bonusXp']) ? estado['bonusXp'] : null;
  for (const parte of Array.isArray(bonus?.['partes']) ? bonus['partes'] : []) {
    if (!isObj(parte) || typeof parte['id'] !== 'string') continue;
    // Twitch e Kick vêm com mais detalhe nos blocos próprios (abaixo).
    if (parte['id'] === 'twitch' || parte['id'] === 'kick') continue;
    const tr = num(parte['tr']);
    add(
      `parte:${parte['id']}`,
      parte['ate'],
      tr !== null ? `+${Math.round((tr - 1) * 100)}% XP` : null,
    );
  }
  for (const canal of ['twitch', 'kick'] as const) {
    const bloco = isObj(estado[canal]) ? estado[canal] : null;
    if (isObj(bloco?.['bonus'])) {
      for (const [k, v] of Object.entries(bloco['bonus'])) add(`${canal}:${k}`, v);
    }
  }
  return out;
}

/**
 * Extrai do estado bruto da /hunt só os campos usados pelo hub. Roda dentro da página: e-mail,
 * nick, logins, guild, Pokédex completa e os demais pokemon não saem dela.
 *
 * @param estado Estado remontado pela /hunt (`eu`).
 * @returns Subconjunto, ou `null` se não parecer um estado de conta.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function pickHuntState(estado: unknown): HuntState | null {
  if (!isObj(estado)) return null;
  const pokemons = (Array.isArray(estado['pokemons']) ? estado['pokemons'] : []).filter(isObj);
  const ativo = pokemons.find((p) => p['id'] === estado['activeId']);
  const automation = isObj(estado['automation']) ? estado['automation'] : null;
  const items = estado['items'];
  const selvagem = isObj(estado['selvagem']) ? estado['selvagem'] : null;
  const passe = isObj(estado['passe']) ? estado['passe'] : null;
  const sazonal = isObj(estado['diaSazonal']) ? estado['diaSazonal'] : null;
  return {
    level: num(estado['level']),
    xpTotal: num(estado['xp']),
    noCentro: bool(estado['noCentro']),
    huntSlug: typeof estado['huntSlug'] === 'string' ? estado['huntSlug'] : null,
    wild: selvagem ? { nome: selvagem['nome'], level: selvagem['level'] } : null,
    active: ativo ? pokemonOf(ativo) : null,
    team: pokemons.filter((p) => num(p['slot']) !== null).map(pokemonOf),
    balls: estado['balls'] ?? null,
    potions: sumIds(items, automation?.['potionIds']),
    revives: sumIds(items, automation?.['reviveIds']),
    automation: automation
      ? {
          autoRevive: automation['autoRevive'],
          autoPotion: automation['autoPotion'],
          autoVoltarHunt: automation['autoVoltarHunt'],
          autoBallSemParar: automation['autoBallSemParar'],
        }
      : null,
    pass: passe ? { ultimo: passe['ultimo'], degrau: passe['degrau'] } : null,
    boosts: boostsOf(estado),
    seasonalType: sazonal?.['tipo'] ?? null,
    dexKills: sumField(estado['pokedex'], 'k'),
    dexCaptures: sumField(estado['pokedex'], 'c'),
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

/** Nomes dos boosts (chaves do jogo → nomes do GAME_RULES.md e dos títulos do próprio estado). */
const BOOST_NAMES: Readonly<Record<string, string>> = {
  'loja:xp': 'XP Boost',
  'loja:pokexp': 'XP Boost Pokemon',
  'loja:loot': 'Loot Boost',
  'loja:captura': 'Capture Boost',
  'parte:vip': 'VIP',
  'parte:guildBoost': 'Boost da Guild',
  'parte:evento': 'Evento',
  'twitch:xp': 'Twitch +15% XP',
  'twitch:captura': 'Twitch +15% Capture Boost',
  'twitch:shiny': 'Twitch +15% Secret Lure',
  'kick:xp': 'Kick +15% XP',
  'kick:captura': 'Kick +15% Capture Boost',
  'kick:shiny': 'Kick +15% Secret Lure',
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
 * Região de uma hunt pelo nível, só quando o nível consta no catálogo da wiki (GAME_RULES.md §3).
 *
 * @param level Nível da hunt.
 * @returns Região ou `null`.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function regionForLevel(level: number): string | null {
  for (const [region, levels] of Object.entries(KNOWN_HUNT_LEVELS)) {
    if (levels.includes(level)) return region;
  }
  return null;
}

/**
 * Número do dia (dias desde 1970) no fuso de Brasília, como `passe.ultimo` (UTC−3, sem horário
 * de verão desde 2019).
 *
 * @param now Instante.
 * @returns Dia.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function brasiliaDayIndex(now: Date): number {
  return Math.floor((now.getTime() - 3 * 3_600_000) / 86_400_000);
}

function activePokemonOf(a: HuntPokemon): AccountSnapshot['activePokemon'] | undefined {
  const ivs = sixStats(a.ivs);
  const stats = sixStats(a.stats);
  const types = Array.isArray(a.tipos)
    ? a.tipos.filter((t): t is string => typeof t === 'string' && t.length > 0)
    : [];
  const level = num(a.level);
  const power = num(a.potencia);
  const quality = num(a.quality);
  if (
    typeof a.nome !== 'string' ||
    a.nome.length === 0 ||
    level === null ||
    level <= 0 ||
    !ivs ||
    !stats ||
    types.length < 1 ||
    types.length > 2 ||
    power === null ||
    ![1, 2, 3, 4, 5].includes(power) ||
    quality === null ||
    quality < 0
  ) {
    return undefined;
  }
  return {
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

/**
 * Campos do snapshot que vêm do estado da /hunt. Sem valor confiável, o campo fica de fora (o
 * leitor mantém o que veio da tela ou `null`).
 *
 * @param state Subconjunto repassado pela página.
 * @param now Agora (boosts vencidos são descartados; dia do passe).
 * @returns Campos parciais do snapshot.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function snapshotFieldsFromHunt(state: HuntState, now: Date): Partial<AccountSnapshot> {
  const fields: Partial<AccountSnapshot> = {};
  if (state.level !== null && Number.isInteger(state.level) && state.level > 0) {
    fields.trainerLevel = state.level;
  }

  // Status e hunt atual.
  const wildLevel = num(state.wild?.level);
  if (state.noCentro === true) {
    fields.status = 'center';
    fields.hunt = null;
  } else if (state.noCentro === false && state.huntSlug && wildLevel !== null && wildLevel > 0) {
    fields.status = 'hunting';
    const name =
      typeof state.wild?.nome === 'string' && state.wild.nome ? state.wild.nome : state.huntSlug;
    fields.hunt = {
      region: regionForLevel(wildLevel),
      level: Math.round(wildLevel),
      name: name.slice(0, 120),
    };
  }

  const active = state.active ? activePokemonOf(state.active) : undefined;
  if (active) fields.activePokemon = active;

  const team = state.team
    .map((p) => ({
      p,
      slot: num(p.slot) ?? 0,
      hp: num(p.hp),
      max: num(p.maxHp),
      level: num(p.level),
    }))
    .filter(
      (t) =>
        typeof t.p.nome === 'string' &&
        t.hp !== null &&
        t.max !== null &&
        t.max > 0 &&
        t.level !== null &&
        t.level > 0,
    )
    .sort((a, b) => a.slot - b.slot)
    .slice(0, 5)
    .map((t) => ({
      species: String(t.p.nome).slice(0, 64),
      level: Math.round(t.level ?? 1),
      hpPct: Math.min(100, Math.max(0, ((t.hp ?? 0) / (t.max ?? 1)) * 100)),
    }));
  if (team.length > 0) fields.team = team;

  if (isObj(state.balls)) {
    const balls: Record<string, number> = {};
    for (const [id, count] of Object.entries(state.balls)) {
      const n = num(count);
      if (n !== null && n >= 0 && id.length <= 32) balls[id] = Math.floor(n);
    }
    fields.inventory = {
      bronzeBossToken: null,
      potions: state.potions === null ? null : Math.floor(state.potions),
      revives: state.revives === null ? null : Math.floor(state.revives),
      balls,
    };
  }

  const auto = state.automation;
  if (auto) {
    const revive = bool(auto.autoRevive);
    const potions = bool(auto.autoPotion);
    const back = bool(auto.autoVoltarHunt);
    const nonstop = bool(auto.autoBallSemParar);
    if (revive !== null && potions !== null && back !== null && nonstop !== null) {
      const noItems = state.potions === 0 && state.revives === 0;
      fields.automations = {
        revive: revive ? 'on' : 'off',
        potions: potions ? 'on' : 'off',
        returnToHunt: back ? (noItems ? 'paused' : 'on') : 'off',
        throwNonstop: nonstop ? 'on' : 'off',
      };
    }
  }

  const ultimo = num(state.pass?.ultimo);
  const degrau = num(state.pass?.degrau);
  if (ultimo !== null || degrau !== null) {
    fields.daily = {
      battlePassDay:
        degrau !== null && Number.isInteger(degrau) && degrau >= 1 && degrau <= 30 ? degrau : null,
      battlePassClaimedToday: ultimo === null ? null : ultimo === brasiliaDayIndex(now),
      topIdleVotedToday: null,
    };
  }

  const nowMs = now.getTime();
  fields.boosts = state.boosts
    .filter((b) => b.until > nowMs)
    .slice(0, 32)
    .map((b) => ({
      kind: (BOOST_NAMES[b.key] ?? b.key.replace(/^\w+:/, '')).slice(0, 64),
      expiresAt: new Date(b.until).toISOString(),
      note: b.note,
    }));

  if (typeof state.seasonalType === 'string' && state.seasonalType.length > 0) {
    fields.seasonalTypeOfDay = titleCase(state.seasonalType).slice(0, 32);
  }

  fields.counters = {
    kills: state.dexKills === null ? null : Math.floor(state.dexKills),
    captures: state.dexCaptures === null ? null : Math.floor(state.dexCaptures),
    xpTrainer: state.xpTotal,
  };
  return fields;
}
