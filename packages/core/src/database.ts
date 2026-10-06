import { Pool } from 'pg';

import type { Logger } from './logger.ts';

export function createPool(connectionString: string, logger: Logger): Pool {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5_000 });
  // Idle clients can error (e.g. server restart); without a listener the process would crash.
  pool.on('error', (error) => {
    logger.error({ err: error }, 'idle postgres client error');
  });
  return pool;
}
