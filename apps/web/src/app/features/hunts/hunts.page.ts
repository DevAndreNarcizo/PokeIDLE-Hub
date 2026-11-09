/**
 * Tela "Onde caçar?" (DESIGN.md §5): ficha do pokemon ativo vinda da sincronização e lista de hunts
 * liberadas para o treinador, com valores medidos nas sessões reais. Sem ranking: sem posição nem
 * destaque de "melhor hunt"; a ordem segue a aba ativa.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import type { OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AccountId, HuntMetric, HuntsResponse } from '@pokeidle-hub/shared';
import { ApiClient } from '../../core/api.client';
import { formatDecimal, formatInt } from '../../core/format';
import { HubStore } from '../../core/hub-store';
import { statusOf } from '../dashboard/account-panel/account-model';
import { HUNT_TABS, TYPE_COLORS, regionChips, toRowView } from './hunts-model';

/**
 * Página de hunts por conta.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Component({
  selector: 'hub-hunts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './hunts.page.html',
  styleUrl: './hunts.page.scss',
})
export class HuntsPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiClient);
  protected readonly store = inject(HubStore);
  protected readonly tabs = HUNT_TABS;
  protected readonly typeColors = TYPE_COLORS;

  protected readonly accountId = signal<AccountId>(1);
  protected readonly metric = signal<HuntMetric>('xp');
  protected readonly region = signal<string | null>(null);
  protected readonly data = signal<HuntsResponse | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);

  protected readonly accountTabs = computed(() =>
    this.store.accounts().map((a) => ({
      id: a.accountId,
      name: a.nick ?? a.label,
      level: a.snapshot?.trainerLevel ? `nv ${formatInt(a.snapshot.trainerLevel)}` : 'nv —',
      tone: statusOf(a).tone,
    })),
  );
  protected readonly note = computed(
    () => HUNT_TABS.find((t) => t.id === this.metric())?.note ?? '',
  );
  protected readonly allRows = computed(() => {
    const hunts = this.data()?.hunts ?? [];
    return this.metric() === 'rares' ? hunts.filter((h) => h.outland !== null) : hunts;
  });
  protected readonly chips = computed(() => regionChips(this.allRows(), this.metric()));
  protected readonly rows = computed(() =>
    this.allRows()
      .filter((h) => this.region() === null || h.region === this.region())
      .map(toRowView),
  );
  protected readonly pokemon = computed(() => {
    const p = this.data()?.activePokemon;
    if (!p) return null;
    const ivTotal = Object.values(p.ivs).reduce((a, b) => a + b, 0);
    const keys: [keyof typeof p.stats, string][] = [
      ['hp', 'HP'],
      ['atk', 'ATK'],
      ['def', 'DEF'],
      ['spAtk', 'SP.ATK'],
      ['spDef', 'SP.DEF'],
      ['spd', 'SPD'],
    ];
    return {
      species: p.species,
      initial: p.species.charAt(0).toUpperCase(),
      level: `Nv ${formatInt(p.level)}`,
      types: p.types,
      line: `P${p.power} · Q ${formatDecimal(p.quality)} · IV ${formatInt(ivTotal)}${p.shiny ? ' · shiny' : ''}`,
      stats: keys.map(([k, label]) => ({
        label,
        value: formatInt(p.stats[k]),
        iv: `IV ${formatInt(p.ivs[k])}`,
      })),
    };
  });

  constructor() {
    // Recarrega quando a conta ou a aba mudam.
    effect(() => {
      const accountId = this.accountId();
      const metric = this.metric();
      void this.load(accountId, metric);
    });
  }

  ngOnInit(): void {
    void this.store.start();
  }

  ngOnDestroy(): void {
    this.store.stop();
  }

  protected selectAccount(id: AccountId): void {
    this.accountId.set(id);
    this.region.set(null);
  }

  protected selectMetric(metric: HuntMetric): void {
    this.metric.set(metric);
    this.region.set(null);
  }

  protected typeStyle(type: string): string {
    const color = TYPE_COLORS[type];
    return color ? `background:${color};border-color:${color}` : '';
  }

  protected focusAccount(): void {
    void this.store.focusAccount(this.accountId());
  }

  protected sync(): void {
    void this.store.syncAll().then(() => this.load(this.accountId(), this.metric()));
  }

  private async load(accountId: AccountId, metric: HuntMetric): Promise<void> {
    this.loading.set(true);
    try {
      this.data.set(
        await this.api.get<HuntsResponse>(`/hunts?accountId=${accountId}&metric=${metric}`),
      );
      this.error.set(null);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Falha ao carregar as hunts');
    } finally {
      this.loading.set(false);
    }
  }
}
