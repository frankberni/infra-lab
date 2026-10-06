import { summarizeJobDataSchema, type DocumentRepository, type Logger } from '@infra-lab/core';
import { UnrecoverableError, type Job } from 'bullmq';

export interface FailureHandlerDependencies {
  documents: Pick<DocumentRepository, 'markFailed'>;
  logger: Logger;
}

export type FailedJob = Pick<Job<unknown>, 'id' | 'data' | 'attemptsMade' | 'opts'>;

/** Client-visible error stored on the document; the actual cause only goes to the logs. */
export const DOCUMENT_FAILURE_MESSAGE = 'Document processing failed';

/**
 * In the `failed` event `attemptsMade` already includes the attempt that just failed.
 * Stalled jobs over maxStalledCount also land here, as UnrecoverableError.
 */
export function isFinalFailure(job: FailedJob, error: Error): boolean {
  return error instanceof UnrecoverableError || job.attemptsMade >= (job.opts.attempts ?? 1);
}

/** Handler for the worker `failed` event: marks the document failed once BullMQ gives up. Never rejects. */
export function createFailureHandler({ documents, logger }: FailureHandlerDependencies) {
  return async (job: FailedJob | undefined, error: Error): Promise<void> => {
    if (!job) {
      logger.error({ err: error }, 'job failed');
      return;
    }
    if (!isFinalFailure(job, error)) {
      logger.warn({ err: error, jobId: job.id, attemptsMade: job.attemptsMade }, 'job attempt failed, retrying');
      return;
    }

    const data = summarizeJobDataSchema.safeParse(job.data);
    const documentId = data.success ? data.data.documentId : undefined;
    logger.error({ err: error, jobId: job.id, documentId }, 'document processing failed');
    if (documentId === undefined) return;

    await documents.markFailed(documentId, DOCUMENT_FAILURE_MESSAGE).catch((markError: unknown) => {
      logger.error({ err: markError, documentId }, 'failed to mark document as failed');
    });
  };
}
