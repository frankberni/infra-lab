import type { Logger } from '@infra-lab/core';
import express, { type Express } from 'express';

import { createDocumentsRouter, type DocumentsRouterDependencies } from './documents.router.ts';
import { JSON_BODY_LIMIT_BYTES } from './documents.schemas.ts';
import { createErrorHandler, notFoundHandler } from './error-handlers.ts';
import { createHealthRouter, type HealthChecks } from './health.router.ts';

export interface AppDependencies extends DocumentsRouterDependencies {
  healthChecks: HealthChecks;
  logger: Logger;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: JSON_BODY_LIMIT_BYTES }));

  app.use(createHealthRouter(deps.healthChecks, deps.logger));
  app.use('/documents', createDocumentsRouter(deps));

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));
  return app;
}
