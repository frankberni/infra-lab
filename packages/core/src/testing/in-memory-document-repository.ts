import { randomUUID } from 'node:crypto';

import type { Document } from '../document.ts';
import type { DocumentRepository } from '../document-repository.ts';

/** Test double for DocumentRepository; `documents` is exposed for assertions and seeding. */
export class InMemoryDocumentRepository implements DocumentRepository {
  readonly documents = new Map<string, Document>();

  create(text: string): Promise<Document> {
    const now = new Date();
    const document: Document = {
      id: randomUUID(),
      text,
      status: 'pending',
      result: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    this.documents.set(document.id, document);
    return Promise.resolve({ ...document });
  }

  findById(id: string): Promise<Document | null> {
    const document = this.documents.get(id);
    return Promise.resolve(document ? { ...document } : null);
  }

  markProcessing(id: string): Promise<Document | null> {
    return Promise.resolve(this.update(id, { status: 'processing', error: null }));
  }

  markCompleted(id: string, result: Document['result']): Promise<void> {
    this.update(id, { status: 'completed', result, error: null });
    return Promise.resolve();
  }

  markFailed(id: string, error: string): Promise<void> {
    this.update(id, { status: 'failed', error });
    return Promise.resolve();
  }

  private update(id: string, changes: Partial<Document>): Document | null {
    const current = this.documents.get(id);
    if (!current) return null;
    const updated: Document = { ...current, ...changes, updatedAt: new Date() };
    this.documents.set(id, updated);
    return { ...updated };
  }
}
