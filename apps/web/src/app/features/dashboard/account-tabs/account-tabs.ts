/**
 * Abas das 4 contas no celular (DESIGN.md §4): `role="tablist"`, `aria-selected` e navegação por
 * teclado (setas, Home e End) com tabindex móvel. Cada aba mostra ponto de status, nome e nível.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
} from '@angular/core';
import type { AccountId, AccountView } from '@pokeidle-hub/shared';
import { formatInt } from '../../../core/format';
import { statusOf } from '../account-panel/account-model';

/**
 * Lista de abas das contas.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Component({
  selector: 'hub-account-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist" aria-label="Contas">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          role="tab"
          class="tab tone-{{ tab.tone }}"
          [id]="'tab-' + tab.id"
          [attr.aria-selected]="tab.id === selected()"
          [attr.aria-controls]="'tabpanel-' + tab.id"
          [tabIndex]="tab.id === selected() ? 0 : -1"
          (click)="selected.set(tab.id)"
          (keydown)="onKey($event)"
        >
          <span class="name"><span class="dot" aria-hidden="true"></span>{{ tab.name }}</span>
          <span class="level">{{ tab.level }}</span>
          <span class="visually-hidden">, {{ tab.status }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    .tabs {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      padding: 10px 16px;
    }
    .tab {
      display: grid;
      justify-items: center;
      align-content: center;
      gap: 2px;
      min-height: 56px;
      padding: 4px;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
      cursor: pointer;
    }
    .tab[aria-selected='true'] {
      border-color: var(--accent);
      background: var(--surface-2);
    }
    .name {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      font-size: 13px;
      white-space: nowrap;
    }
    .level {
      color: var(--muted);
      font-size: 11px;
    }
  `,
})
export class AccountTabs {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly accounts = input.required<readonly AccountView[]>();
  readonly selected = model.required<AccountId>();

  protected readonly tabs = computed(() =>
    this.accounts().map((a) => {
      const status = statusOf(a);
      const level = a.snapshot?.trainerLevel;
      return {
        id: a.accountId,
        name: a.nick ?? a.label,
        level: level ? `nv ${formatInt(level)}` : 'nv —',
        tone: status.tone,
        status: status.label,
      };
    }),
  );

  protected onKey(event: KeyboardEvent): void {
    const ids = this.tabs().map((t) => t.id);
    const index = ids.indexOf(this.selected());
    const target =
      event.key === 'ArrowRight'
        ? ids[(index + 1) % ids.length]
        : event.key === 'ArrowLeft'
          ? ids[(index - 1 + ids.length) % ids.length]
          : event.key === 'Home'
            ? ids[0]
            : event.key === 'End'
              ? ids.at(-1)
              : undefined;
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    this.selected.set(target);
    this.host.nativeElement.querySelector<HTMLButtonElement>(`#tab-${target}`)?.focus();
  }
}
