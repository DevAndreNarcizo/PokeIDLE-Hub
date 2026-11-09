/**
 * Apresentação da tela de hunts (DESIGN.md §5), em funções puras: textos das abas, chips de região,
 * selos de tipo e formatação das colunas. Sem medição → "sem medição ainda"; sem fonte → "—".
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { HuntMetric, HuntRow } from '@pokeidle-hub/shared';
import { formatCompact, formatDecimal, formatInt } from '../../core/format';

/**
 * Abas da tela.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const HUNT_TABS: readonly { id: HuntMetric; label: string; note: string }[] = [
  {
    id: 'xp',
    label: 'XP/h',
    note: 'XP/h do treinador medido nas sessões reais desta conta, com o pokemon ativo. Hunts ainda não caçadas aparecem como "sem medição ainda".',
  },
  {
    id: 'gold',
    label: 'Ouro/h',
    note: 'Ouro ganho por hora, medido pela diferença do contador da sessão. Não inclui estimativas.',
  },
  {
    id: 'shiny',
    label: 'Shiny/h',
    note: 'Horas esperadas por shiny: 24.000 ÷ abates/h medidos (1 tentativa por corpo, sem bônus). Na Outland o shiny não rola.',
  },
  {
    id: 'rares',
    label: 'Raros/h',
    note: 'Outlands liberadas: abates/h medidos × chance da wiki × multiplicador da Outland (sem Loot Boost). As 8 Outlands têm os mesmos pokemon, então a medição de uma vale para todas.',
  },
];

/**
 * Cores dos selos de tipo (DESIGN.md §1). Tipos sem cor definida usam o selo neutro.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const TYPE_COLORS: Readonly<Record<string, string>> = {
  Fire: '#C4461C',
  Flying: '#4A6FB5',
  Grass: '#2F7D32',
  Bug: '#5E7F1A',
  Poison: '#8A3FB0',
  Ice: '#1F7FA0',
  Ground: '#8A6A2A',
  Psychic: '#B03A7A',
};

/**
 * Valor de uma linha para exibição.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface HuntRowView {
  key: string;
  title: string;
  initial: string;
  level: string;
  region: string;
  xp: string;
  gold: string;
  kills: string;
  killTime: string;
  risk: string;
  shiny: string;
  measured: string;
  rares: { token: string; key: string; stone: string; bike: string } | null;
}

const NO_MEASURE = 'sem medição ainda';

/**
 * Formata uma linha.
 *
 * @param row Linha da API.
 * @returns Textos.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function toRowView(row: HuntRow): HuntRowView {
  const title = row.name ?? `${row.region} · hunt nv ${formatInt(row.level)}`;
  const perHour = (v: number | null) => (v === null ? '—' : formatDecimal(v));
  return {
    key: `${row.region}|${row.level}`,
    title,
    initial: (row.name ?? row.region).charAt(0).toUpperCase(),
    level: `Nv ${formatInt(row.level)}`,
    region: row.region,
    xp: row.measured ? formatCompact(row.xpPerHour) : NO_MEASURE,
    gold: row.measured ? formatCompact(row.goldPerHour) : NO_MEASURE,
    kills: row.measured
      ? formatInt(row.killsPerHour === null ? null : Math.round(row.killsPerHour))
      : NO_MEASURE,
    killTime: '—',
    risk: '—',
    shiny:
      row.outland !== null
        ? 'não rola'
        : row.shinyHours === null
          ? NO_MEASURE
          : `1 a cada ${formatDecimal(Math.round(row.shinyHours))} h`,
    measured: row.measured
      ? `medido em ${formatDecimal(row.measured.hours)} h${row.measured.species ? ` com ${row.measured.species}` : ''}`
      : '',
    rares: row.rares
      ? {
          token: perHour(row.rares.bronzeBossToken),
          key: perHour(row.rares.keyFragment),
          stone: perHour(row.rares.shinyStoneFragment),
          bike: perHour(row.rares.bicycleFragment),
        }
      : null,
  };
}

/**
 * Chips de região: "Todas" e cada região presente, com o melhor XP/h medido na aba XP/h.
 *
 * @param rows Linhas.
 * @param metric Aba ativa.
 * @returns Chips.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function regionChips(
  rows: readonly HuntRow[],
  metric: HuntMetric,
): { id: string | null; label: string; best: string | null }[] {
  const best = (list: readonly HuntRow[]) => {
    if (metric !== 'xp') return null;
    const values = list.map((r) => r.xpPerHour).filter((v): v is number => v !== null);
    return values.length ? formatCompact(Math.max(...values)) : null;
  };
  const regions = [...new Set(rows.map((r) => r.region))];
  return [
    { id: null, label: 'Todas', best: best(rows) },
    ...regions.map((region) => ({
      id: region,
      label: region,
      best: best(rows.filter((r) => r.region === region)),
    })),
  ];
}
