import { STATUS_CODES } from 'node:http';

import type { Logger } from '@infra-lab/core';
import type { ErrorRequestHandler, RequestHandler } from 'express';

/** Status of client errors raised by middleware (e.g. body-parser: malformed JSON, payload too large). */
function clientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const { status } = error;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not Found' });
};

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const status = clientErrorStatus(error);
    if (status !== undefined) {
      res.status(status).json({ error: STATUS_CODES[status] ?? 'Bad Request' });
      return;
    }

    logger.error({ err: error, method: req.method, path: req.path }, 'unhandled request error');
    res.status(500).json({ error: 'Internal Server Error' });
  };
}
