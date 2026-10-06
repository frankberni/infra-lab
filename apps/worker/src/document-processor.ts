import { summarizeJobDataSchema, type DocumentRepository } from '@infra-lab/core';
import { UnrecoverableError, type Job } from 'bullmq';

import type { Summarizer } from './summarizer.ts';

export interface DocumentProcessorDependencies {
  documents: Pick<DocumentRepository, 'markProcessing' | 'markCompleted'>;
  summarizer: Summarizer;
}

export type DocumentJob = Pick<Job<unknown>, 'data'>;

/**
 * Errors are left to BullMQ: retryable ones are retried, and the document is marked failed by the
 * worker's `failed` handler (see failure-handler.ts) once no attempts are left.
 */
export function createDocumentProcessor({ documents, summarizer }: DocumentProcessorDependencies) {
  return async (job: DocumentJob): Promise<void> => {
    const data = summarizeJobDataSchema.safeParse(job.data);
    if (!data.success) throw new UnrecoverableError('Invalid job payload');
    const { documentId } = data.data;

    const document = await documents.markProcessing(documentId);
    if (!document) throw new UnrecoverableError(`Document ${documentId} not found`);

    const summary = await summarizer.summarize(document.text);
    await documents.markCompleted(documentId, summary);
  };
}
