/**
 * Guard das rotas do painel: sem sessão, redireciona para `/login`.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Exige sessão válida.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.check()) ? true : router.parseUrl('/login');
};
