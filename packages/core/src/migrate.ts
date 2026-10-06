import { z } from 'zod';

import { envFields, loadConfig } from './config.ts';
import { createPool } from './database.ts';
import { createLogger } from './logger.ts';
import { runMigrations } from './migrator.ts';

const config = loadConfig(z.object({ DATABASE_URL: envFields.DATABASE_URL, LOG_LEVEL: envFields.LOG_LEVEL }));
const logger = createLogger('migrate', config.LOG_LEVEL);
const pool = createPool(config.DATABASE_URL, logger);

try {
  const applied = await runMigrations(pool, new URL('../migrations/', import.meta.url), logger);
  logger.info({ applied: applied.length }, 'migrations up to date');
} catch (error) {
  logger.fatal({ err: error }, 'migration failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}
