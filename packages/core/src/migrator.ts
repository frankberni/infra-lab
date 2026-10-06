import { readdir, readFile } from 'node:fs/promises';

import type { Pool } from 'pg';

import type { Logger } from './logger.ts';

/** Arbitrary key for the session advisory lock that serializes concurrent migration runs. */
const MIGRATION_LOCK_KEY = 4_815_162_342;

/** Applies pending `.sql` files from `directory` in lexical order, each one in its own transaction. */
export async function runMigrations(pool: Pool, directory: URL, logger: Logger): Promise<string[]> {
  const files = (await readdir(directory))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => (a < b ? -1 : 1));

  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    try {
      await client.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           name text PRIMARY KEY,
           applied_at timestamptz NOT NULL DEFAULT now()
         )`,
      );
      const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
      const applied = new Set(rows.map((row) => row.name));
      const pending = files.filter((file) => !applied.has(file));

      for (const file of pending) {
        const sql = await readFile(new URL(file, directory), 'utf8');
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
        logger.info({ migration: file }, 'migration applied');
      }
      return pending;
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}
