/**
 * Leitor de tela: monta o {@link AccountSnapshot} a partir do DOM da aba do jogo. Função pura sobre
 * o `Document`, testável com HTML salvo. Tudo que ainda não tem leitura documentada fica `null`
 * (regra 1 do CLAUDE.md: não inventar dado do jogo).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { AccountId, AccountSnapshot, AccountStatus } from '@pokeidle-hub/shared';
import { SCREEN_TEXT } from './selectors.js';

/**
 * Detecta o status da conta pelo que está visível.
 *
 * @param doc Documento da aba do jogo.
 * @returns Status; `unknown` quando não há sinal documentado.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function detectStatus(doc: Document): AccountStatus {
  const text = normalize(doc.body?.textContent ?? '');
  if (text.includes(normalize(SCREEN_TEXT.conflict))) {
    return 'conflict';
  }
  // TODO(game-data): sinais de "caçando" e "No Centro Pokemon" (OPEN_QUESTIONS.md #12).
  return 'unknown';
}

/**
 * Lê o snapshot da conta a partir do documento.
 *
 * @param doc Documento da aba do jogo.
 * @param accountId Conta deste perfil (vem do `hello.ok` da ponte).
 * @param now Instante da captura.
 * @returns Snapshot válido pelo contrato compartilhado.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function readSnapshot(doc: Document, accountId: AccountId, now: Date): AccountSnapshot {
  return {
    ...emptySnapshot(accountId, now),
    status: detectStatus(doc),
  };
}

/**
 * Snapshot de conta sem sessão aberta neste perfil (nenhuma aba do jogo).
 *
 * @param accountId Conta.
 * @param now Instante.
 * @returns Snapshot com status `offline`.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function offlineSnapshot(accountId: AccountId, now: Date): AccountSnapshot {
  return { ...emptySnapshot(accountId, now), status: 'offline' };
}

function emptySnapshot(accountId: AccountId, now: Date): AccountSnapshot {
  return {
    accountId,
    capturedAt: now.toISOString(),
    source: 'extension',
    status: 'unknown',
    trainerLevel: null,
    hunt: null,
    team: [],
    activePokemon: null,
    session: null,
    inventory: null,
    boosts: [],
    automations: null,
    daily: null,
    seasonalTypeOfDay: null,
  };
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
}
