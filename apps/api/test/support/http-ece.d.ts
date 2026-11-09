/**
 * Tipos mínimos do `http_ece` (dependência do web-push), usado só nos testes para decifrar
 * mensagens de push.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
declare module 'http_ece' {
  import type { ECDH } from 'node:crypto';

  /** Decifra um corpo `aes128gcm`. */
  export function decrypt(
    buffer: Buffer,
    params: { version: string; privateKey: ECDH; authSecret: Buffer },
  ): Buffer;
}
