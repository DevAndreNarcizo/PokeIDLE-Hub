/**
 * Provedores globais da aplicação (roteamento e tratamento global de erros).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { ApplicationConfig } from '@angular/core';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

/**
 * Configuração raiz passada ao `bootstrapApplication`.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes)],
};
