/**
 * Cliente HTTP da API (`/api`, mesma origem). Usa os cookies de sessão e, quando o token de
 * acesso expira (`401 token_expired`), renova a sessão uma vez e repete a chamada.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Injectable } from '@angular/core';

/** Prefixo da API no navegador (proxy do `ng serve` em dev e nginx em produção). */
export const API_BASE = '/api';

/**
 * Erro de chamada à API com status e código estável.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class ApiError extends Error {
  /**
   * @param status Status HTTP (0 = rede indisponível).
   * @param code Código devolvido pela API.
   * @param message Mensagem para o usuário.
   */
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Cliente da API.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private refreshing: Promise<boolean> | null = null;

  /**
   * GET com JSON.
   *
   * @param path Caminho sem o prefixo (ex.: `/accounts`).
   * @returns Corpo JSON tipado pelo chamador.
   */
  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  /**
   * POST com JSON.
   *
   * @param path Caminho sem o prefixo.
   * @param body Corpo opcional.
   * @returns Corpo JSON (ou `undefined` em 204).
   */
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  /**
   * Renova a sessão pelo cookie de refresh. Chamadas simultâneas compartilham a mesma renovação.
   *
   * @returns `true` se a sessão foi renovada.
   */
  refresh(): Promise<boolean> {
    this.refreshing ??= fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'same-origin',
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  private async request<T>(path: string, init: RequestInit, retried = false): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, { ...init, credentials: 'same-origin' });
    } catch {
      throw new ApiError(0, 'network', 'Sem conexão com o hub');
    }
    if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
      const body = await safeJson(res);
      if (body?.error?.code === 'token_expired' && (await this.refresh())) {
        return this.request<T>(path, init, true);
      }
      throw new ApiError(
        401,
        body?.error?.code ?? 'unauthorized',
        body?.error?.message ?? 'Sessão expirada',
      );
    }
    if (!res.ok) {
      const body = await safeJson(res);
      throw new ApiError(
        res.status,
        body?.error?.code ?? 'http_error',
        body?.error?.message ?? `Erro ${res.status}`,
      );
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

async function safeJson(res: Response): Promise<ErrorBody | null> {
  try {
    return (await res.json()) as ErrorBody;
  } catch {
    return null;
  }
}
