import { withTimeout, type Logger } from '@infra-lab/core';
import { Router } from 'express';

export type HealthChecks = Readonly<Record<string, () => Promise<unknown>>>;

const HEALTH_CHECK_TIMEOUT_MS = 2_000;

export function createHealthRouter(checks: HealthChecks, logger: Logger): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const results = await Promise.all(
      Object.entries(checks).map(async ([name, check]) => {
        try {
          await withTimeout(check(), HEALTH_CHECK_TIMEOUT_MS, `${name} health check`);
          return [name, 'ok'] as const;
        } catch (error) {
          logger.warn({ err: error, dependency: name }, 'health check failed');
          return [name, 'unavailable'] as const;
        }
      }),
    );

    const healthy = results.every(([, state]) => state === 'ok');
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      checks: Object.fromEntries(results),
    });
  });

  return router;
}
