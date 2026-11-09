/**
 * Utilitário de linha de comando: lê a senha do painel da entrada padrão e imprime o hash
 * argon2id para `HUB_ADMIN_PASSWORD_HASH`. A senha não é registrada em lugar nenhum.
 *
 * Uso: `npm run hash-password -w @pokeidle-hub/api` e digite a senha seguida de Enter.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { createInterface } from 'node:readline/promises';
import { hashPassword } from '../auth/password.js';

const MIN_LENGTH = 12;

async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: false });
  process.stderr.write('Senha do painel: ');
  const password = (await rl.question('')).trim();
  rl.close();
  if (password.length < MIN_LENGTH) {
    process.stderr.write(`\nUse pelo menos ${MIN_LENGTH} caracteres.\n`);
    process.exit(1);
  }
  process.stdout.write(`${await hashPassword(password)}\n`);
}

void main();
