import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AccountId, AccountView } from '@pokeidle-hub/shared';
import { AccountTabs } from './account-tabs';

const accounts: AccountView[] = ([1, 2, 3, 4] as const).map((id) => ({
  accountId: id,
  label: `Conta ${id}`,
  nick: null,
  snapshot: null,
  receivedAt: null,
  stale: true,
}));

@Component({
  imports: [AccountTabs],
  template: '<hub-account-tabs [accounts]="accounts" [(selected)]="selected" />',
})
class Host {
  accounts = accounts;
  selected = signal<AccountId>(1);
}

describe('AccountTabs', () => {
  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const tabs = () => [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    return { fixture, el, tabs };
  }

  it('expõe tablist com aria-selected e tabindex móvel', () => {
    const { el, tabs } = render();
    expect(el.querySelector('[role="tablist"]')).not.toBeNull();
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ]);
    expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1, -1, -1]);
    expect(tabs()[0]?.getAttribute('aria-controls')).toBe('tabpanel-1');
  });

  it('setas, Home e End trocam a aba e o foco', () => {
    const { fixture, tabs } = render();
    const key = (k: string) => {
      tabs()[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      fixture.detectChanges();
    };
    key('ArrowRight');
    expect(fixture.componentInstance.selected()).toBe(2);
    expect(document.activeElement?.id).toBe('tab-2');
    key('ArrowLeft');
    key('ArrowLeft');
    expect(fixture.componentInstance.selected()).toBe(4);
    key('Home');
    expect(fixture.componentInstance.selected()).toBe(1);
    key('End');
    expect(fixture.componentInstance.selected()).toBe(4);
  });

  it('clique seleciona', () => {
    const { fixture, tabs } = render();
    tabs()[2]?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe(3);
  });
});
