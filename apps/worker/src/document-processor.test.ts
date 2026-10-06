import { InMemoryDocumentRepository } from '@infra-lab/core/testing';
import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { createDocumentProcessor } from './document-processor.ts';
import { FakeSummarizer } from './fake-summarizer.ts';
import type { Summarizer } from './summarizer.ts';

const failingSummarizer: Summarizer = {
  summarize: () => Promise.reject(new Error('model unavailable')),
};

describe('document processor', () => {
  let documents: InMemoryDocumentRepository;

  beforeEach(() => {
    documents = new InMemoryDocumentRepository();
  });

  it('summarizes the document and marks it completed', async () => {
    const { id } = await documents.create('Queues decouple work. Workers scale out. Retries absorb failures.');
    const process = createDocumentProcessor({ documents, summarizer: new FakeSummarizer() });

    await process({ data: { documentId: id } });

    const stored = await documents.findById(id);
    expect(stored?.status).toBe('completed');
    expect(stored?.result?.keyPoints).toHaveLength(3);
    expect(stored?.result?.wordCount).toBe(9);
  });

  it('fails without retry when the document does not exist', async () => {
    const process = createDocumentProcessor({ documents, summarizer: new FakeSummarizer() });

    await expect(process({ data: { documentId: crypto.randomUUID() } })).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('fails without retry on an invalid payload', async () => {
    const process = createDocumentProcessor({ documents, summarizer: new FakeSummarizer() });

    await expect(process({ data: { documentId: 'not-a-uuid' } })).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('rethrows summarizer errors for BullMQ to retry, leaving the document processing', async () => {
    const { id } = await documents.create('Some text.');
    const process = createDocumentProcessor({ documents, summarizer: failingSummarizer });

    await expect(process({ data: { documentId: id } })).rejects.toThrow('model unavailable');

    expect((await documents.findById(id))?.status).toBe('processing');
  });
});
