/**
 * Sessão do painel (um único usuário). Mantém o estado em signal e expõe login, logout e a
 * verificação inicial usada pelo guard de rota.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Injectable, inject, signal } from '@angular/core';
import { ApiClient, ApiError } from './api.client';

/**
 * Estado da sessão.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type AuthState = 'unknown' | 'authenticated' | 'anonymous';

/**
 * Serviço de autenticação.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  readonly state = signal<AuthState>('unknown');

  /**
   * Confirma se há sessão válida (renovando se preciso).
   *
   * @returns `true` se autenticado.
   */
  async check(): Promise<boolean> {
    if (this.state() === 'authenticated') {
      return true;
    }
    try {
      await this.api.get('/auth/session');
      this.state.set('authenticated');
    } catch (error) {
      const renewed =
        error instanceof ApiError && error.status === 401 && (await this.api.refresh());
      if (renewed) {
        this.state.set('authenticated');
      } else {
        this.state.set('anonymous');
      }
    }
    return this.state() === 'authenticated';
  }

  /**
   * Entra com a senha do painel.
   *
   * @param password Senha.
   * @throws ApiError com a mensagem para o usuário.
   */
  async login(password: string): Promise<void> {
    await this.api.post('/auth/login', { password });
    this.state.set('authenticated');
  }

  /** Sai e revoga a sessão. */
  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout');
    } finally {
      this.state.set('anonymous');
    }
  }

  /** Marca a sessão como perdida (ex.: refresh recusado). */
  markLost(): void {
    this.state.set('anonymous');
  }
}
