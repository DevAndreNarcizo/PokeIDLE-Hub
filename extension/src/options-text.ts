/**
 * Textos da página de opções (estado da ponte e fonte da leitura), separados para teste.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { BridgeStatus } from './bridge-client.js';

/**
 * Texto em pt-BR para cada estado da ponte.
 *
 * @param status Estado.
 * @returns Descrição.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function describeStatus(status: BridgeStatus | undefined): string {
  switch (status?.state) {
    case 'connected':
      return `Conectado ao hub como Conta ${status.accountId}.`;
    case 'connecting':
      return 'Conectando…';
    case 'auth_failed':
      return 'Token recusado pelo hub. Gere um novo token para esta conta e salve de novo.';
    case 'replaced':
      return 'Outra instância da ponte desta conta assumiu a conexão. Use um perfil do Brave por conta.';
    case 'disconnected':
      return `Sem conexão. Nova tentativa em ${Math.round(status.retryInMs / 1000)} s.`;
    default:
      return 'Ainda não configurado.';
  }
}

/**
 * Texto da fonte da última leitura.
 *
 * @param reader Valor gravado pelo service worker.
 * @returns Descrição.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function describeReader(reader: unknown): string {
  switch (reader) {
    case 'hunt_extension':
      return 'Fonte: estado do jogo pela extensão /hunt for PokeIdle (completa).';
    case 'dom':
      return 'Fonte: leitura da tela (limitada). Instale a /hunt for PokeIdle neste perfil e recarregue a aba do jogo.';
    case 'none':
      return 'Fonte: nenhuma aba do jogo aberta neste perfil.';
    default:
      return 'Fonte: ainda sem leitura.';
  }
}
