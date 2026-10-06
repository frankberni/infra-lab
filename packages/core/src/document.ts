import { z } from 'zod';

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export const documentIdSchema = z.uuid();

export interface Summary {
  title: string;
  keyPoints: [string, string, string];
  wordCount: number;
}

export interface Document {
  id: string;
  text: string;
  status: DocumentStatus;
  result: Summary | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}
