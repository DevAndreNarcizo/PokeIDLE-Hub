/**
 * Provedores globais da aplicação (roteamento e tratamento global de erros).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { ApplicationConfig } from '@angular/core';
import { provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';

/**
 * Configuração raiz passada ao `bootstrapApplication`.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
