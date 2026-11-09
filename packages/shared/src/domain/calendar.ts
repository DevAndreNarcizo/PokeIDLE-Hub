/**
 * Calendário recorrente do jogo (GAME_RULES.md §11), calculado no fuso de Brasília. Sem datas
 * fixas: tudo é derivado das regras recorrentes (PRD F4: "nenhuma data hardcoded").
 * As conversões de fuso usam `Intl`, então valem também para fusos com horário de verão.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { GAME_TIME_ZONE } from '../game-rules/constants.js';

/**
 * Data e hora locais de um fuso.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface LocalDateTime {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = domingo … 6 = sábado */
  weekday: number;
}

/**
 * Evento do calendário.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface GameEvent {
  /** Identificador estável da ocorrência (tipo + data local). */
  id: string;
  kind: GameEventKind;
  title: string;
  action: string;
  /** Início (UTC, ISO 8601). Para prazos de dia inteiro, 00:00 local do dia. */
  at: string;
  /** Prazo que vale o dia inteiro (ex.: "inscrições até dia 13"). */
  allDay: boolean;
}

/**
 * Tipos de evento recorrente.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type GameEventKind =
  | 'daily_reset'
  | 'seasonal_type'
  | 'guild_war'
  | 'raid_close'
  | 'raid_battle'
  | 'raid_open'
  | 'showdown_lock'
  | 'showdown_fights'
  | 'amateur_signup'
  | 'amateur_fights'
  | 'world_signup'
  | 'world_fights'
  | 'weekly_reset'
  | 'monthly_close';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Converte um instante para data/hora local do fuso.
 *
 * @param instant Instante.
 * @param timeZone Fuso IANA.
 * @returns Partes locais.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function toLocal(instant: Date, timeZone = GAME_TIME_ZONE): LocalDateTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: WEEKDAYS.indexOf(get('weekday')),
  };
}

/**
 * Converte data/hora local do fuso para o instante UTC. Se o horário não existir (salto do
 * horário de verão), usa o primeiro instante válido depois dele.
 *
 * @param local Data/hora local (sem `weekday`).
 * @param timeZone Fuso IANA.
 * @returns Instante.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function fromLocal(local: Omit<LocalDateTime, 'weekday'>, timeZone = GAME_TIME_ZONE): Date {
  const wallMs = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  // Ajuste iterativo do deslocamento do fuso (converge em até 2 passos, inclusive em transições).
  let guess = wallMs;
  for (let i = 0; i < 3; i++) {
    const l = toLocal(new Date(guess), timeZone);
    const seenMs = Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute);
    const diff = wallMs - seenMs;
    if (diff === 0) {
      return new Date(guess);
    }
    guess += diff;
  }
  // Horário inexistente: avança até o primeiro minuto válido.
  return new Date(guess);
}

/**
 * Dia local (YYYY-MM-DD) do instante no fuso de Brasília. Usado como chave do diário.
 *
 * @param instant Instante.
 * @param timeZone Fuso.
 * @returns Data local.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function localDay(instant: Date, timeZone = GAME_TIME_ZONE): string {
  const l = toLocal(instant, timeZone);
  return `${l.year}-${String(l.month).padStart(2, '0')}-${String(l.day).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Próximos eventos recorrentes a partir de `now`, em ordem cronológica.
 *
 * @param now Instante de referência.
 * @param limit Quantidade máxima (padrão 6).
 * @param timeZone Fuso (padrão: Brasília).
 * @returns Eventos futuros; prazos de dia inteiro aparecem enquanto o dia não terminou.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function nextEvents(now: Date, limit = 6, timeZone = GAME_TIME_ZONE): GameEvent[] {
  const events: GameEvent[] = [];
  const today = toLocal(now, timeZone);
  const todayKey = localDay(now, timeZone);

  for (let offset = 0; offset < 40; offset++) {
    // Meio-dia evita qualquer ambiguidade de virada ao andar dia a dia.
    const noon = fromLocal(
      { year: today.year, month: today.month, day: today.day + offset, hour: 12, minute: 0 },
      timeZone,
    );
    const d = toLocal(noon, timeZone);
    const key = localDay(noon, timeZone);
    const at = (hour: number, minute = 0) =>
      fromLocal({ year: d.year, month: d.month, day: d.day, hour, minute }, timeZone).toISOString();
    const add = (
      kind: GameEventKind,
      title: string,
      action: string,
      hour: number,
      minute = 0,
      allDay = false,
    ) => events.push({ id: `${kind}:${key}`, kind, title, action, at: at(hour, minute), allDay });

    add('daily_reset', 'Virada do dia', 'Passe e voto renovam', 0);
    add('seasonal_type', 'Dia Sazonal', 'Sorteio da tipagem', 18);
    add('guild_war', 'Guerra de Guilds', 'Batalha', 19);
    if (d.weekday === 1) {
      add('raid_close', 'Raid Gigantamax', 'Inscrição fecha', 16);
      add('raid_battle', 'Raid Gigantamax', 'Batalha', 20);
    }
    if (d.weekday === 2) {
      add('raid_open', 'Raid Gigantamax', 'Inscrição abre', 12);
    }
    if (d.weekday === 3) {
      add('showdown_lock', 'Showdown', 'Inscrições e equipe travam', 20);
      add('showdown_fights', 'Showdown', 'Lutas', 21);
    }
    if (d.weekday === 6) {
      add('weekly_reset', 'Virada semanal', 'PvP Ranqueado e Top Catch zeram', 23, 59);
    }
    if (d.day === 13) {
      add('amateur_signup', 'Campeonato Amador', 'Último dia de inscrição', 0, 0, true);
    }
    if (d.day === 15) {
      add('amateur_fights', 'Campeonato Amador', 'Lutas', 0);
    }
    if (d.day === 28) {
      add('world_signup', 'Mundial', 'Último dia de inscrição', 0, 0, true);
    }
    if (d.day === daysInMonth(d.year, d.month)) {
      add('world_fights', 'Mundial', 'Lutas', 0);
    }
    if (d.day === 1) {
      add('monthly_close', 'Fechamento mensal', 'Rankings mensais fecham', 0);
    }
  }

  const nowMs = now.getTime();
  return events
    .filter((e) =>
      e.allDay ? e.id.endsWith(todayKey) || Date.parse(e.at) >= nowMs : Date.parse(e.at) >= nowMs,
    )
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .slice(0, limit);
}
