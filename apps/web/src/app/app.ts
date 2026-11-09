/**
 * Componente raiz: só hospeda o `router-outlet`.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Casca da aplicação.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Component({
  imports: [RouterOutlet],
  selector: 'hub-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<router-outlet />',
})
// Casca sem lógica: o roteamento faz todo o trabalho.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class App {}
