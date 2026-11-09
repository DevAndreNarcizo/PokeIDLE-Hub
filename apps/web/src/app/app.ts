/**
 * Componente raiz: hospeda o `router-outlet`. O layout real (barra global e grid) vem na Fase 3.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Casca da aplicação.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Component({
  imports: [RouterOutlet],
  selector: 'hub-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = 'PokeIdle Hub';
}
