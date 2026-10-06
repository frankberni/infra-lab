import { describe, expect, it } from 'vitest';

import { FakeSummarizer, summarizeText } from './fake-summarizer.ts';

describe('summarizeText', () => {
  it('uses the first sentences as title and key points and counts real words', () => {
    const summary = summarizeText(
      'Postgres stores the documents.  Redis holds the queue! Workers process jobs? Extra sentence here.',
    );

    expect(summary).toEqual({
      title: 'Postgres stores the documents.',
      keyPoints: ['Postgres stores the documents.', 'Redis holds the queue!', 'Workers process jobs?'],
      wordCount: 14,
    });
  });

  it('does not count standalone punctuation as words', () => {
    expect(summarizeText('one — two - three').wordCount).toBe(3);
  });

  it('truncates long titles to 80 characters', () => {
    const summary = summarizeText(`${'word '.repeat(40)}end.`);

    expect(summary.title).toHaveLength(80);
    expect(summary.title.endsWith('…')).toBe(true);
  });

  it('always returns three key points, padding short texts deterministically', () => {
    const summary = summarizeText('Just one sentence about one topic.');

    expect(summary.keyPoints).toEqual([
      'Just one sentence about one topic.',
      'Word count: 6',
      'Sentence count: 1',
    ]);
    expect(summarizeText('Just one sentence about one topic.')).toEqual(summary);
  });
});

describe('FakeSummarizer', () => {
  it('resolves the same summary as summarizeText', async () => {
    const text = 'A first sentence. A second one.';

    await expect(new FakeSummarizer().summarize(text)).resolves.toEqual(summarizeText(text));
  });
});
