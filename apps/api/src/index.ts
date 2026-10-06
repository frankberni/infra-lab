import { promisify } from 'node:util';

import {
  createDocumentRepository,
  createLogger,
  createPool,
  loadConfig,
  registerShutdown,
  withTimeout,
} from '@infra-lab/core';

import { createApp } from './app.ts';
import { apiEnvSchema } from './config.ts';
import { createDocumentQueue, createEnqueue } from './document-queue.ts';
import { closeRedis, createRedis } from './redis.ts';

const REDIS_STARTUP_TIMEOUT_MS = 10_000;

const config = loadConfig(apiEnvSchema);
const logger = createLogger('api', config.LOG_LEVEL);
const pool = createPool(config.DATABASE_URL, logger);
const redis = createRedis(config.REDIS_URL);
const queue = createDocumentQueue(redis);
queue.on('error', (error) => {
  logger.warn({ err: error }, 'redis connection error');
});

// BullMQ initializes its connection once: if that fails the queue stays unusable, so we fail fast.
try {
  await withTimeout(queue.waitUntilReady(), REDIS_STARTUP_TIMEOUT_MS, 'redis startup');
} catch (error) {
  logger.fatal({ err: error }, 'redis unavailable at startup');
  process.exit(1);
}

const app = createApp({
  documents: createDocumentRepository(pool),
  enqueue: createEnqueue(queue),
  healthChecks: {
    postgres: () => pool.query('SELECT 1'),
    redis: () => redis.ping(),
  },
  logger,
});

const server = app.listen(config.PORT, (error) => {
  if (error) {
    logger.fatal({ err: error }, 'http server failed to start');
    process.exit(1);
  }
  logger.info({ port: config.PORT }, 'api started');
});

registerShutdown(
  [
    { name: 'http server', close: promisify(server.close.bind(server)) },
    { name: 'queue', close: () => queue.close() },
    { name: 'redis', close: () => closeRedis(redis) },
    { name: 'postgres', close: () => pool.end() },
  ],
  logger,
);
