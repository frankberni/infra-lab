import { summarizeJobDataSchema, type DocumentRepository, type Logger } from '@infra-lab/core';
import { UnrecoverableError, type Job } from 'bullmq';

import type { Summarizer } from './summarizer.ts';

export interface DocumentProcessorDependencies {
  documents: Pick<DocumentRepository, 'markProcessing' | 'markCompleted' | 'markFailed'>;
  summarizer: Summarizer;
  logger: Logger;
}

export type DocumentJob = Pick<Job<unknown>, 'data' | 'attemptsMade' | 'opts'>;

const MAX_ERROR_LENGTH = 1_000;

/** `attemptsMade` counts the attempts that already failed, so the current one is attemptsMade + 1. */
function isFinalAttempt(job: DocumentJob): boolean {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_ERROR_LENGTH);
}

export function createDocumentProcessor({ documents, summarizer, logger }: DocumentProcessorDependencies) {
  return async (job: DocumentJob): Promise<void> => {
    const data = summarizeJobDataSchema.safeParse(job.data);
    if (!data.success) throw new UnrecoverableError('Invalid job payload');
    const { documentId } = data.data;

    try {
      const document = await documents.markProcessing(documentId);
      if (!document) throw new UnrecoverableError(`Document ${documentId} not found`);

      const summary = await summarizer.summarize(document.text);
      await documents.markCompleted(documentId, summary);
    } catch (error) {
      // Retryable errors are rethrown for BullMQ to retry; only the last attempt marks the document failed.
      if (!(error instanceof UnrecoverableError) && isFinalAttempt(job)) {
        await documents.markFailed(documentId, errorMessage(error)).catch((markError: unknown) => {
          logger.error({ err: markError, documentId }, 'failed to mark document as failed');
        });
      }
      throw error;
    }
  };
}
