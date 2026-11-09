/**
 * Breakpoints do layout (DESIGN.md §3–§4) como signals: abaixo de 820 px usa o layout de celular;
 * a partir de 2200 × 900 px, o grid 2×2 (cada painel precisa de ~1040 px para as duas colunas).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/** Largura máxima do layout de celular. */
export const MOBILE_MAX_WIDTH = 819;
/** Largura mínima do grid 2×2. */
export const GRID_MIN_WIDTH = 2200;

/**
 * Observa as media queries do layout.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Injectable({ providedIn: 'root' })
export class Viewport {
  readonly mobile = this.watch(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
  readonly grid = this.watch(`(min-width: ${GRID_MIN_WIDTH}px) and (min-height: 900px)`);

  private watch(query: string) {
    const media = typeof matchMedia === 'function' ? matchMedia(query) : null;
    const value = signal(media?.matches ?? false);
    const listener = (event: MediaQueryListEvent) => value.set(event.matches);
    media?.addEventListener('change', listener);
    inject(DestroyRef).onDestroy(() => media?.removeEventListener('change', listener));
    return value.asReadonly();
  }
}
