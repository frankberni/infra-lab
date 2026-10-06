import { createLogger } from '@infra-lab/core';
import { InMemoryDocumentRepository } from '@infra-lab/core/testing';
import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { createFailureHandler, DOCUMENT_FAILURE_MESSAGE, type FailedJob } from './failure-handler.ts';

const logger = createLogger('test', 'silent');
const internalError = new Error('connect ECONNREFUSED 10.0.0.5:5432');

function failedJob(documentId: string, attemptsMade: number): FailedJob {
  return { id: documentId, data: { documentId }, attemptsMade, opts: { attempts: 3 } };
}

describe('failure handler', () => {
  let documents: InMemoryDocumentRepository;
  let documentId: string;

  beforeEach(async () => {
    documents = new InMemoryDocumentRepository();
    documentId = (await documents.create('Some text.')).id;
    await documents.markProcessing(documentId);
  });

  it('leaves the document untouched while attempts remain', async () => {
    await createFailureHandler({ documents, logger })(failedJob(documentId, 2), internalError);

    expect((await documents.findById(documentId))?.status).toBe('processing');
  });

  it('marks the document failed with a public message once attempts are exhausted', async () => {
    await createFailureHandler({ documents, logger })(failedJob(documentId, 3), internalError);

    const stored = await documents.findById(documentId);
    expect(stored?.status).toBe('failed');
    expect(stored?.error).toBe(DOCUMENT_FAILURE_MESSAGE);
  });

  it('marks the document failed on an unrecoverable error, e.g. a stalled job over the limit', async () => {
    const stalled = new UnrecoverableError('job stalled more than allowable limit');

    await createFailureHandler({ documents, logger })(failedJob(documentId, 1), stalled);

    expect((await documents.findById(documentId))?.status).toBe('failed');
  });

  it('never rejects, even when marking the document fails', async () => {
    const handler = createFailureHandler({
      documents: { markFailed: () => Promise.reject(new Error('postgres down')) },
      logger,
    });

    await expect(handler(failedJob(documentId, 3), internalError)).resolves.toBeUndefined();
    await expect(handler(undefined, internalError)).resolves.toBeUndefined();
  });
});
