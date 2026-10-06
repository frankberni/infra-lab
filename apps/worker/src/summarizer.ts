import type { Summary } from '@infra-lab/core';

export interface Summarizer {
  summarize(text: string): Promise<Summary>;
}
