/**
 * Rotas do painel. Todas exigem sessão, exceto o login.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

/**
 * Tabela de rotas da aplicação.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage),
    title: 'Entrar · PokeIdle Hub',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
    title: 'PokeIdle Hub',
  },
  { path: '**', redirectTo: '' },
];
