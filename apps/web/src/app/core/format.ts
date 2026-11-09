/**
 * Formatação para exibição em pt-BR, com datas convertidas para `America/Sao_Paulo` só aqui, na
 * borda (CLAUDE.md, convenções). Valores nulos viram "—" (dado não lido, nunca zero inventado).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */

const TIME_ZONE = 'America/Sao_Paulo';
const DASH = '—';

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const clock = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const shortClock = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Número compacto ("2,1 mi", "921,2 mil").
 *
 * @param value Valor ou `null`.
 * @returns Texto.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function formatCompact(value: number | null | undefined): string {
  return value === null || value === undefined ? DASH : compact.format(value);
}

/**
 * Inteiro com separador de milhar ("5.310").
 *
 * @param value Valor ou `null`.
 * @returns Texto.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function formatInt(value: number | null | undefined): string {
  return value === null || value === undefined ? DASH : integer.format(value);
}

/**
 * Número com até 1 casa decimal ("26,1").
 *
 * @param value Valor ou `null`.
 * @returns Texto.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function formatDecimal(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? DASH
    : decimal.format(value);
}

/**
 * Hora de Brasília "HH:mm:ss".
 *
 * @param iso Instante ISO 8601 ou `null`.
 * @returns Texto.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function formatClock(iso: string | null | undefined): string {
  return iso ? clock.format(new Date(iso)) : DASH;
}

/**
 * Hora de Brasília "HH:mm".
 *
 * @param iso Instante ISO 8601 ou `null`.
 * @returns Texto.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function formatShortClock(iso: string | null | undefined): string {
  return iso ? shortClock.format(new Date(iso)) : DASH;
}

/**
 * Tempo restante legível ("4 h 12", "18 d", "35 min").
 *
 * @param untilIso Instante final.
 * @param now Agora.
 * @returns Texto; "expirado" quando já passou.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function formatRemaining(untilIso: string | null, now: Date): string {
  if (!untilIso) {
    return '';
  }
  const ms = new Date(untilIso).getTime() - now.getTime();
  if (ms <= 0) {
    return 'expirado';
  }
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    const rest = minutes % 60;
    return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
  }
  return `${Math.floor(hours / 24)} d`;
}
