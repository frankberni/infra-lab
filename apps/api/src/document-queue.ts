import {
  DOCUMENT_QUEUE_NAME,
  SUMMARIZE_JOB_NAME,
  withTimeout,
  type SummarizeJobData,
} from '@infra-lab/core';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

const ENQUEUE_TIMEOUT_MS = 5_000;

export function createDocumentQueue(connection: Redis): Queue<SummarizeJobData> {
  return new Queue<SummarizeJobData>(DOCUMENT_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: { count: 1_000, age: 24 * 60 * 60 },
      removeOnFail: { count: 5_000, age: 7 * 24 * 60 * 60 },
    },
  });
}

/** jobId = documentId makes enqueueing idempotent: BullMQ ignores a duplicate id. */
export function createEnqueue(queue: Queue<SummarizeJobData>): (documentId: string) => Promise<void> {
  return async (documentId) => {
    await withTimeout(
      queue.add(SUMMARIZE_JOB_NAME, { documentId }, { jobId: documentId }),
      ENQUEUE_TIMEOUT_MS,
      'enqueue',
    );
  };
}
