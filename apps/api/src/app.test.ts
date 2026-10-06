import { createLogger } from '@infra-lab/core';
import { InMemoryDocumentRepository } from '@infra-lab/core/testing';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp, type AppDependencies } from './app.ts';

const logger = createLogger('test', 'silent');

describe('api', () => {
  let documents: InMemoryDocumentRepository;
  let enqueue: ReturnType<typeof vi.fn<AppDependencies['enqueue']>>;
  let deps: AppDependencies;

  beforeEach(() => {
    documents = new InMemoryDocumentRepository();
    enqueue = vi.fn<AppDependencies['enqueue']>().mockResolvedValue(undefined);
    deps = {
      documents,
      enqueue,
      logger,
      healthChecks: { postgres: () => Promise.resolve(), redis: () => Promise.resolve() },
    };
  });

  describe('POST /documents', () => {
    it('stores a pending document, enqueues it and responds 202', async () => {
      const res = await request(createApp(deps)).post('/documents').send({ text: '  Hello world.  ' });

      expect(res.status).toBe(202);
      expect(res.body).toEqual({ id: expect.any(String) as string, status: 'pending' });
      const { id } = res.body as { id: string };
      expect(enqueue).toHaveBeenCalledWith(id);
      expect((await documents.findById(id))?.text).toBe('Hello world.');
    });

    it.each([
      ['missing text', {}],
      ['blank text', { text: '   ' }],
      ['non-string text', { text: 42 }],
      ['text over the limit', { text: 'a'.repeat(100_001) }],
    ])('responds 400 on %s', async (_case, body) => {
      const res = await request(createApp(deps)).post('/documents').send(body);

      expect(res.status).toBe(400);
      expect(enqueue).not.toHaveBeenCalled();
      expect(documents.documents.size).toBe(0);
    });

    it('responds 400 on malformed JSON without leaking details', async () => {
      const res = await request(createApp(deps))
        .post('/documents')
        .set('Content-Type', 'application/json')
        .send('{"text": ');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Bad Request' });
    });

    it('responds 413 when the body exceeds the size limit', async () => {
      const res = await request(createApp(deps))
        .post('/documents')
        .send({ text: '\u0001'.repeat(110_000) });

      expect(res.status).toBe(413);
      expect(res.body).toEqual({ error: 'Payload Too Large' });
    });

    it('marks the document failed and responds 503 when enqueueing fails', async () => {
      enqueue.mockRejectedValue(new Error('redis down'));

      const res = await request(createApp(deps)).post('/documents').send({ text: 'Hello world.' });

      expect(res.status).toBe(503);
      const [stored] = documents.documents.values();
      expect(stored?.status).toBe('failed');
    });
  });

  describe('GET /documents/:id', () => {
    it('responds 400 when the id is not a uuid', async () => {
      const res = await request(createApp(deps)).get('/documents/not-a-uuid');

      expect(res.status).toBe(400);
    });

    it('responds 404 when the document does not exist', async () => {
      const res = await request(createApp(deps)).get(`/documents/${crypto.randomUUID()}`);

      expect(res.status).toBe(404);
    });

    it('responds 200 with the document state, without the original text', async () => {
      const { id } = await documents.create('Hello world.');

      const res = await request(createApp(deps)).get(`/documents/${id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id,
        status: 'pending',
        result: null,
        error: null,
        createdAt: expect.any(String) as string,
        updatedAt: expect.any(String) as string,
      });
    });
  });

  describe('GET /health', () => {
    it('responds 200 when every dependency is reachable', async () => {
      const res = await request(createApp(deps)).get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', checks: { postgres: 'ok', redis: 'ok' } });
    });

    it('responds 503 with the per-dependency state when one is down', async () => {
      deps.healthChecks = {
        postgres: () => Promise.resolve(),
        redis: () => Promise.reject(new Error('ECONNREFUSED 10.0.0.1:6379')),
      };

      const res = await request(createApp(deps)).get('/health');

      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: 'degraded', checks: { postgres: 'ok', redis: 'unavailable' } });
    });
  });

  it('responds 404 JSON on unknown routes', async () => {
    const res = await request(createApp(deps)).get('/nope');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found' });
  });
});
