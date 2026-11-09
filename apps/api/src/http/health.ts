/**
 * Rota `GET /health` para monitoramento (ARCHITECTURE.md §10). Executa as verificações
 * registradas (ex.: banco) e responde 200 quando todas passam ou 503 quando alguma falha.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { Router } from 'express';

/**
 * Verificação de saúde nomeada; resolve `true` quando o componente está saudável.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export type HealthCheck = () => Promise<boolean>;

/**
 * Cria o roteador de saúde.
 *
 * @param checks Verificações por nome (ex.: `{ database: pingDb }`).
 * @param version Versão da API exibida na resposta.
 * @returns Roteador Express.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function createHealthRouter(
  checks: Readonly<Record<string, HealthCheck>>,
  version: string,
): Router {
  const router = Router();
  router.get('/health', async (_req, res) => {
    const entries = await Promise.all(
      Object.entries(checks).map(async ([name, check]) => {
        try {
          return [name, (await check()) ? 'ok' : 'fail'] as const;
        } catch {
          return [name, 'fail'] as const;
        }
      }),
    );
    const results = Object.fromEntries(entries);
    const healthy = entries.every(([, state]) => state === 'ok');
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      version,
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
      checks: results,
    });
  });
  return router;
}
