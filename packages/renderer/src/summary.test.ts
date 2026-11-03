import { describe, expect, it } from 'vitest';
import { summaryParagraphs } from './summary';

describe('summary paragraphs', () => {
  it('never turns text-length boundaries into paragraphs or loses whitespace and Unicode', () => {
    for (const length of [149, 150, 151, 499, 500, 501, 20_000]) {
      const text = `Über mich 😀  ${'a'.repeat(length)}`;
      expect(summaryParagraphs(text)).toEqual([text]);
    }
  });
  it('recognizes only user-entered line breaks as paragraph boundaries', () => {
    expect(summaryParagraphs('Erster Absatz\r\n\r\nZweiter Absatz\nDritter Absatz')).toEqual([
      'Erster Absatz',
      'Zweiter Absatz',
      'Dritter Absatz',
    ]);
    expect(summaryParagraphs('')).toEqual([]);
  });
});
