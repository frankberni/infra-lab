import { documentIdSchema, type DocumentRepository, type Logger } from '@infra-lab/core';
import { Router, type Response } from 'express';
import type { z } from 'zod';

import { createDocumentBodySchema } from './documents.schemas.ts';

export interface DocumentsRouterDependencies {
  documents: Pick<DocumentRepository, 'create' | 'findById' | 'markFailed'>;
  enqueue: (documentId: string) => Promise<void>;
  logger: Logger;
}

const ENQUEUE_FAILED_MESSAGE = 'Failed to enqueue document for processing';

function sendValidationError(res: Response, message: string, error: z.ZodError): void {
  res.status(400).json({
    error: message,
    issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  });
}

export function createDocumentsRouter({ documents, enqueue, logger }: DocumentsRouterDependencies): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const body = createDocumentBodySchema.safeParse(req.body);
    if (!body.success) {
      sendValidationError(res, 'Invalid request body', body.error);
      return;
    }

    const document = await documents.create(body.data.text);
    try {
      await enqueue(document.id);
    } catch (error) {
      logger.error({ err: error, documentId: document.id }, 'failed to enqueue document');
      await documents.markFailed(document.id, ENQUEUE_FAILED_MESSAGE);
      res.status(503).json({ error: 'Service Unavailable' });
      return;
    }

    res.status(202).json({ id: document.id, status: document.status });
  });

  router.get('/:id', async (req, res) => {
    const id = documentIdSchema.safeParse(req.params.id);
    if (!id.success) {
      sendValidationError(res, 'Invalid document id', id.error);
      return;
    }

    const document = await documents.findById(id.data);
    if (!document) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }

    const { status, result, error, createdAt, updatedAt } = document;
    res.json({ id: document.id, status, result, error, createdAt, updatedAt });
  });

  return router;
}
