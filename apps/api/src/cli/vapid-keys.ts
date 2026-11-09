/**
 * Gera um par de chaves VAPID para o Web Push. Cole no `.env` (VAPID_PUBLIC_KEY e
 * VAPID_PRIVATE_KEY). A chave privada é segredo: nunca versione.
 *
 * Uso: `npm run vapid-keys -w @pokeidle-hub/api`
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
process.stdout.write(`VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`);
