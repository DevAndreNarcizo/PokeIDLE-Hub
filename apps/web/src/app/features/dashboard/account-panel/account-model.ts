/**
 * Regras de apresentação do painel da conta (DESIGN.md §2–§3), em funções puras e testáveis:
 * status com rótulo e cor, banners, métricas e equipe. Sem dado, mostra "—"; nunca inventa.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountSnapshot, AccountView, AutoState } from '@pokeidle-hub/shared';
import { formatCompact, formatInt, formatShortClock } from '../../../core/format';

/**
 * Tom visual (cor do token).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type Tone = 'ok' | 'info' | 'warn' | 'off';

/**
 * Status exibido.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface StatusView {
  key: AccountSnapshot['status'] | 'stale';
  label: string;
  tone: Tone;
}

/**
 * Banner de alerta do painel.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface BannerView {
  kind: 'conflict' | 'team_down' | 'no_items' | 'stale';
  text: string;
  tone: Tone;
  /** Ação do banner (só no conflito: "Jogar aqui" foca a janela da conta). */
  action: 'focus' | null;
}

/**
 * Métrica da grade.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface MetricView {
  label: string;
  value: string;
}

const STATUS: Record<AccountSnapshot['status'], StatusView> = {
  hunting: { key: 'hunting', label: 'Caçando', tone: 'ok' },
  center: { key: 'center', label: 'No Centro Pokemon', tone: 'info' },
  conflict: { key: 'conflict', label: 'Aberta em outro lugar', tone: 'warn' },
  offline: { key: 'offline', label: 'Offline', tone: 'off' },
  unknown: { key: 'unknown', label: 'Desatualizado', tone: 'off' },
};

/**
 * Status da conta; dado obsoleto ou ausente vira "Desatualizado".
 *
 * @param view Visão da conta.
 * @returns Status para o chip.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function statusOf(view: AccountView): StatusView {
  if (!view.snapshot || view.stale) {
    return { key: 'stale', label: 'Desatualizado', tone: 'off' };
  }
  return STATUS[view.snapshot.status];
}

/**
 * Snapshot utilizável como "atual" (não obsoleto e não em conflito).
 *
 * @param view Visão da conta.
 * @returns Snapshot ou `null`.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function liveSnapshot(view: AccountView): AccountSnapshot | null {
  const snap = view.snapshot;
  return snap && !view.stale && snap.status !== 'conflict' ? snap : null;
}

/**
 * Banners do painel, do mais grave para o menos grave.
 *
 * @param view Visão da conta.
 * @returns Lista de banners.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function bannersOf(view: AccountView): BannerView[] {
  const banners: BannerView[] = [];
  const snap = view.snapshot;
  if (view.stale || !snap) {
    banners.push({
      kind: 'stale',
      tone: 'off',
      action: null,
      text: view.receivedAt
        ? `Desatualizado: último dado às ${formatShortClock(view.receivedAt)}. Verifique a ponte deste perfil.`
        : 'Sem dados ainda. Instale a ponte no perfil do Brave desta conta.',
    });
    return banners;
  }
  if (snap.status === 'conflict') {
    banners.push({
      kind: 'conflict',
      tone: 'warn',
      action: 'focus',
      text: 'Conta aberta em outro lugar. A sessão do hub está pausada e nada é contabilizado até você voltar.',
    });
    return banners;
  }
  const paused = snap.automations?.returnToHunt === 'paused';
  const noItems = snap.inventory?.potions === 0 && snap.inventory.revives === 0;
  if (isTeamDown(snap)) {
    banners.push({
      kind: 'team_down',
      tone: 'info',
      action: null,
      text:
        paused || noItems
          ? 'Time caiu. Voltar à hunt pausou: sem poções ou revives na mochila.'
          : 'Time caiu.',
    });
  } else if (paused || noItems) {
    banners.push({
      kind: 'no_items',
      tone: 'warn',
      action: null,
      text: 'Voltar à hunt pausou: sem poções ou revives na mochila.',
    });
  }
  return banners;
}

/**
 * Equipe inteira caída (ARCHITECTURE.md §8, `team_down`).
 *
 * @param snap Snapshot.
 * @returns `true` quando todos estão com HP 0.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function isTeamDown(snap: AccountSnapshot): boolean {
  return snap.team.length > 0 && snap.team.every((p) => p.hpPct === 0);
}

/**
 * As 6 métricas da sessão (DESIGN.md §3).
 *
 * @param view Visão da conta.
 * @returns Métricas formatadas; "—" quando desconhecidas ou em conflito.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function metricsOf(view: AccountView): MetricView[] {
  const snap = liveSnapshot(view);
  const session = snap?.session ?? null;
  const shiny =
    session?.shinySeen === null || session?.shinySeen === undefined || session.shinyCaught === null
      ? '—'
      : `${formatInt(session.shinySeen)} / ${formatInt(session.shinyCaught)}`;
  const rares = session?.rareDrops
    ? Object.values(session.rareDrops).reduce((a, b) => a + b, 0)
    : null;
  return [
    { label: 'XP treinador/h', value: formatCompact(session?.xpTrainerPerHour) },
    { label: 'XP pokemon/h', value: formatCompact(session?.xpPokemonPerHour) },
    { label: 'Capturas', value: formatInt(session?.captures) },
    { label: 'Shiny visto / capt.', value: shiny },
    { label: 'Boss Tokens', value: formatInt(snap?.inventory?.bronzeBossToken) },
    { label: 'Raros na sessão', value: formatInt(rares) },
  ];
}

/**
 * Barra de vida de um integrante.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface TeamSlot {
  pct: number;
  tone: Tone;
  label: string;
}

/**
 * Até 5 barras de vida e o texto "X/5 de pé".
 *
 * @param view Visão da conta.
 * @returns Barras e resumo; sem equipe conhecida, `null`.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function teamOf(view: AccountView): { slots: TeamSlot[]; standing: string } | null {
  const snap = view.snapshot;
  if (!snap || snap.team.length === 0) {
    return null;
  }
  const slots = snap.team.map((p) => ({
    pct: p.hpPct,
    tone: (p.hpPct === 0 ? 'off' : p.hpPct <= 30 ? 'warn' : 'ok') as Tone,
    label: `${p.species} nv ${formatInt(p.level)}: ${Math.round(p.hpPct)}% de vida`,
  }));
  const alive = snap.team.filter((p) => p.hpPct > 0).length;
  return { slots, standing: view.stale ? 'último estado' : `${alive}/${snap.team.length} de pé` };
}

const AUTOMATIONS: [keyof NonNullable<AccountSnapshot['automations']>, string][] = [
  ['revive', 'Revive'],
  ['potions', 'Poções'],
  ['returnToHunt', 'Voltar à hunt'],
  ['throwNonstop', 'Lançar sem parar'],
];

const AUTO_LABEL: Record<AutoState, { text: string; tone: Tone }> = {
  on: { text: 'ligada', tone: 'ok' },
  off: { text: 'desligada', tone: 'off' },
  paused: { text: 'pausada', tone: 'warn' },
};

/**
 * Chips das automações.
 *
 * @param snap Snapshot.
 * @returns Lista (vazia quando desconhecida).
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function automationsOf(
  snap: AccountSnapshot | null,
): { name: string; state: string; tone: Tone }[] {
  const automations = snap?.automations;
  if (!automations) {
    return [];
  }
  return AUTOMATIONS.map(([key, name]) => ({
    name,
    state: AUTO_LABEL[automations[key]].text,
    tone: AUTO_LABEL[automations[key]].tone,
  }));
}

/**
 * Hunt atual em texto ("Johto · hunt nv 350").
 *
 * @param snap Snapshot.
 * @returns Texto ou `null`.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function huntLabel(snap: AccountSnapshot | null): string | null {
  if (!snap) return null;
  if (snap.status === 'center') return 'Centro Pokemon';
  if (!snap.hunt) return null;
  const name = snap.hunt.name ? `${snap.hunt.name} · ` : '';
  const region = snap.hunt.region ? `${snap.hunt.region} · ` : '';
  return `${region}${name}hunt nv ${formatInt(snap.hunt.level)}`;
}
