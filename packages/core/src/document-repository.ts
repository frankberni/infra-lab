import type { Pool } from 'pg';

import type { Document, DocumentStatus, Summary } from './document.ts';

export interface DocumentRepository {
  create(text: string): Promise<Document>;
  findById(id: string): Promise<Document | null>;
  /** Moves the document to `processing`; returns null when it does not exist. */
  markProcessing(id: string): Promise<Document | null>;
  markCompleted(id: string, result: Summary): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}

interface DocumentRow {
  id: string;
  text: string;
  status: DocumentStatus;
  result: Summary | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = 'id, text, status, result, error, created_at, updated_at';

function toDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    text: row.text,
    status: row.status,
    result: row.result,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createDocumentRepository(pool: Pool): DocumentRepository {
  async function queryOne(sql: string, params: unknown[]): Promise<Document | null> {
    const { rows } = await pool.query<DocumentRow>(sql, params);
    const row = rows[0];
    return row ? toDocument(row) : null;
  }

  return {
    async create(text) {
      const document = await queryOne(`INSERT INTO documents (text) VALUES ($1) RETURNING ${COLUMNS}`, [text]);
      if (!document) throw new Error('Document insert returned no row');
      return document;
    },

    findById(id) {
      return queryOne(`SELECT ${COLUMNS} FROM documents WHERE id = $1`, [id]);
    },

    markProcessing(id) {
      return queryOne(
        `UPDATE documents SET status = 'processing', error = NULL, updated_at = now()
         WHERE id = $1 RETURNING ${COLUMNS}`,
        [id],
      );
    },

    async markCompleted(id, result) {
      await pool.query(
        `UPDATE documents SET status = 'completed', result = $2::jsonb, error = NULL, updated_at = now()
         WHERE id = $1`,
        [id, JSON.stringify(result)],
      );
    },

    async markFailed(id, error) {
      await pool.query(
        `UPDATE documents SET status = 'failed', error = $2, updated_at = now() WHERE id = $1`,
        [id, error],
      );
    },
  };
}
