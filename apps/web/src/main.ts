/**
 * Inicialização do PWA Angular do PokeIdle Hub.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err: unknown) => {
  // Falha de bootstrap acontece antes de qualquer logger existir; o console é o único canal.
  // eslint-disable-next-line no-console
  console.error(err);
});
