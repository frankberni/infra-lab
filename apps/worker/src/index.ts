import {
  DOCUMENT_QUEUE_NAME,
  createDocumentRepository,
  createLogger,
  createPool,
  loadConfig,
  registerShutdown,
  type SummarizeJobData,
} from '@infra-lab/core';
import { Worker } from 'bullmq';

import { workerEnvSchema } from './config.ts';
import { createDocumentProcessor } from './document-processor.ts';
import { FakeSummarizer } from './fake-summarizer.ts';

const config = loadConfig(workerEnvSchema);
const logger = createLogger('worker', config.LOG_LEVEL);
const pool = createPool(config.DATABASE_URL, logger);

const processor = createDocumentProcessor({
  documents: createDocumentRepository(pool),
  summarizer: new FakeSummarizer({ delayMs: config.SUMMARIZER_DELAY_MS }),
  logger,
});

// BullMQ owns the Redis connections (it requires maxRetriesPerRequest: null) and closes them in worker.close().
const worker = new Worker<SummarizeJobData>(DOCUMENT_QUEUE_NAME, processor, {
  connection: { url: config.REDIS_URL },
  concurrency: config.WORKER_CONCURRENCY,
});

worker.on('error', (error) => {
  logger.error({ err: error }, 'worker error');
});
worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'job completed');
});
worker.on('failed', (job, error) => {
  logger.warn({ err: error, jobId: job?.id, attemptsMade: job?.attemptsMade }, 'job failed');
});

logger.info({ concurrency: config.WORKER_CONCURRENCY }, 'worker started');

registerShutdown(
  [
    { name: 'worker', close: () => worker.close() },
    { name: 'postgres', close: () => pool.end() },
  ],
  logger,
);
