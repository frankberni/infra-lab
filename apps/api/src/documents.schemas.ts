import { z } from 'zod';

export const MAX_TEXT_LENGTH = 100_000;

/**
 * Worst case JSON encoding is 6 bytes per UTF-16 code unit (`\uXXXX`), so any body carrying
 * a valid text fits; anything larger is rejected by the parser before validation.
 */
export const JSON_BODY_LIMIT_BYTES = MAX_TEXT_LENGTH * 6 + 1024;

export const createDocumentBodySchema = z.object({
  text: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
});
