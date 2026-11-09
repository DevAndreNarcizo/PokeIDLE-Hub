/**
 * Tela de login do painel (senha única do dono).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '../../core/api.client';
import { AuthService } from '../../core/auth.service';

/**
 * Página de login.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Component({
  selector: 'hub-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="login">
      <form class="card" (submit)="submit($event)" aria-labelledby="login-title">
        <div class="brand">
          <span class="mark" aria-hidden="true"></span>
          <h1 id="login-title">PokeIdle Hub</h1>
        </div>
        <label for="password" class="label">Senha do painel</label>
        <input
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          required
          [disabled]="busy()"
          (input)="password.set(input.value)"
          #input
        />
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <button class="btn btn--primary" type="submit" [disabled]="busy() || !password()">
          {{ busy() ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
    </main>
  `,
  styles: `
    .login {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 16px;
    }
    .card {
      width: min(380px, 100%);
      display: grid;
      gap: 10px;
      padding: 28px;
      border: 1px solid var(--border);
      border-radius: var(--radius-panel);
      background: var(--surface);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .mark {
      width: 22px;
      height: 22px;
      border-radius: 6px;
      border: 2px solid var(--accent);
      box-shadow:
        inset 0 0 0 4px var(--surface),
        inset 0 0 0 11px var(--accent);
    }
    h1 {
      font-size: 20px;
    }
    input {
      min-height: var(--touch);
      padding: 0 12px;
      border-radius: var(--radius-card);
      border: 1px solid var(--border);
      background: var(--surface-2);
    }
    .error {
      margin: 0;
      color: var(--warn);
    }
    button {
      margin-top: 8px;
    }
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.password());
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.error.set(
        error instanceof ApiError && error.status === 401
          ? 'Senha incorreta.'
          : error instanceof Error
            ? error.message
            : 'Falha ao entrar.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
