import { createLogger } from '@infra-lab/core';
import { InMemoryDocumentRepository } from '@infra-lab/core/testing';
import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { createDocumentProcessor, type DocumentJob } from './document-processor.ts';
import { FakeSummarizer } from './fake-summarizer.ts';
import type { Summarizer } from './summarizer.ts';

const logger = createLogger('test', 'silent');

const failingSummarizer: Summarizer = {
  summarize: () => Promise.reject(new Error('model unavailable')),
};

function job(documentId: string, attemptsMade = 0): DocumentJob {
  return { data: { documentId }, attemptsMade, opts: { attempts: 3 } };
}

describe('document processor', () => {
  let documents: InMemoryDocumentRepository;

  beforeEach(() => {
    documents = new InMemoryDocumentRepository();
  });

  it('summarizes the document and marks it completed', async () => {
    const { id } = await documents.create('Queues decouple work. Workers scale out. Retries absorb failures.');
    const process = createDocumentProcessor({ documents, summarizer: new FakeSummarizer(), logger });

    await process(job(id));

    const stored = await documents.findById(id);
    expect(stored?.status).toBe('completed');
    expect(stored?.result?.keyPoints).toHaveLength(3);
    expect(stored?.result?.wordCount).toBe(9);
  });

  it('fails without retry when the document does not exist', async () => {
    const process = createDocumentProcessor({ documents, summarizer: new FakeSummarizer(), logger });

    await expect(process(job(crypto.randomUUID()))).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('fails without retry on an invalid payload', async () => {
    const process = createDocumentProcessor({ documents, summarizer: new FakeSummarizer(), logger });

    await expect(process(job('not-a-uuid'))).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('leaves the document processing on a non-final failed attempt so BullMQ can retry', async () => {
    const { id } = await documents.create('Some text.');
    const process = createDocumentProcessor({ documents, summarizer: failingSummarizer, logger });

    await expect(process(job(id, 0))).rejects.toThrow('model unavailable');

    expect((await documents.findById(id))?.status).toBe('processing');
  });

  it('marks the document failed on the final attempt', async () => {
    const { id } = await documents.create('Some text.');
    const process = createDocumentProcessor({ documents, summarizer: failingSummarizer, logger });

    await expect(process(job(id, 2))).rejects.toThrow('model unavailable');

    const stored = await documents.findById(id);
    expect(stored?.status).toBe('failed');
    expect(stored?.error).toBe('model unavailable');
  });
});
