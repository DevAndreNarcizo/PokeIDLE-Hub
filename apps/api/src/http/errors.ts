/**
 * Erros HTTP da API e o middleware que os converte em respostas JSON padronizadas, sem vazar
 * detalhes internos.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from '../logger.js';

/**
 * Erro com status HTTP e código estável para o cliente.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export class HttpError extends Error {
  /**
   * @param status Status HTTP.
   * @param code Código estável (ex.: `invalid_credentials`).
   * @param message Mensagem para o cliente.
   * @param details Detalhes opcionais seguros para expor (ex.: problemas de validação).
   */
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Responde 404 para rotas inexistentes.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Rota não encontrada' } });
};

/**
 * Cria o tratador final de erros.
 *
 * @param logger Logger da aplicação.
 * @returns Middleware de erro do Express.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, _req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      });
      return;
    }
    // Corpo JSON malformado ou grande demais vindo do body-parser do Express.
    if (isBodyParserError(err)) {
      res
        .status(err.status)
        .json({ error: { code: 'invalid_body', message: 'Corpo da requisição inválido' } });
      return;
    }
    logger.error({ err }, 'erro não tratado');
    res.status(500).json({ error: { code: 'internal_error', message: 'Erro interno' } });
  };
}

function isBodyParserError(err: unknown): err is { status: number; type: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number' &&
    (err as { status: number }).status < 500
  );
}
