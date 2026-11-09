/**
 * Verificação da senha do painel contra o hash argon2 configurado. Há um único usuário (o dono).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { hash, verify } from '@node-rs/argon2';

/**
 * Função que confere uma senha em claro.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type PasswordVerifier = (password: string) => Promise<boolean>;

/**
 * Cria o verificador a partir do hash argon2 do ambiente.
 *
 * @param passwordHash Hash `$argon2...`.
 * @returns Verificador que nunca lança (hash corrompido = senha inválida).
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function createArgon2Verifier(passwordHash: string): PasswordVerifier {
  return async (password) => {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  };
}

/**
 * Gera o hash argon2id de uma senha (usado pelo utilitário de linha de comando e pelos testes).
 *
 * @param password Senha em claro.
 * @returns Hash argon2id.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}
