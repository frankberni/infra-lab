import { envFields } from '@infra-lab/core';
import { z } from 'zod';

export const apiEnvSchema = z.object({
  ...envFields,
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});
