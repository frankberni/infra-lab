import { setTimeout as delay } from 'node:timers/promises';

import type { Summary } from '@infra-lab/core';

import type { Summarizer } from './summarizer.ts';

const TITLE_MAX_LENGTH = 80;
const KEY_POINT_MAX_LENGTH = 200;

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/** Whitespace-separated tokens containing at least one letter or digit (punctuation alone is not a word). */
function extractWords(text: string): string[] {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token));
}

/** Deterministic summary: first sentence as title, first sentences as key points, padded with text statistics. */
export function summarizeText(text: string): Summary {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const sentences = splitSentences(normalized);
  const words = extractWords(normalized);
  const uniqueWords = new Set(words.map((word) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')));

  const fallbackPoints = [
    `Word count: ${String(words.length)}`,
    `Sentence count: ${String(sentences.length)}`,
    `Distinct words: ${String(uniqueWords.size)}`,
  ];
  const [first = '', second = '', third = ''] = [...sentences.slice(0, 3), ...fallbackPoints].map((point) =>
    truncate(point, KEY_POINT_MAX_LENGTH),
  );

  return {
    title: truncate(sentences[0] ?? 'Untitled', TITLE_MAX_LENGTH),
    keyPoints: [first, second, third],
    wordCount: words.length,
  };
}

export class FakeSummarizer implements Summarizer {
  readonly #delayMs: number;

  constructor({ delayMs = 0 }: { delayMs?: number } = {}) {
    this.#delayMs = delayMs;
  }

  async summarize(text: string): Promise<Summary> {
    if (this.#delayMs > 0) await delay(this.#delayMs);
    return summarizeText(text);
  }
}
