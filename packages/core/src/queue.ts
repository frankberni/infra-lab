import { z } from 'zod';

import { documentIdSchema } from './document.ts';

export const DOCUMENT_QUEUE_NAME = 'documents';
export const SUMMARIZE_JOB_NAME = 'summarize';

export const summarizeJobDataSchema = z.object({ documentId: documentIdSchema });
export type SummarizeJobData = z.infer<typeof summarizeJobDataSchema>;
