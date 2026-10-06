import { envFields } from '@infra-lab/core';
import { z } from 'zod';

export const workerEnvSchema = z.object({
  ...envFields,
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
  SUMMARIZER_DELAY_MS: z.coerce.number().int().min(0).max(5_000).default(0),
});
