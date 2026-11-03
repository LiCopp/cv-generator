import { describe, expect, it } from 'vitest';
import { paginate, paginateWithIntro } from './pagination';

describe('flow pagination', () => {
  it('keeps a section heading and entry title with the following paragraph', () => {
    expect(
      paginate(
        [
          { id: 'intro', height: 70 },
          { id: 'heading', height: 10, keepWithNext: true },
          { id: 'title', height: 15, keepWithNext: true },
          { id: 'paragraph', height: 35 },
        ],
        100,
        120,
      ),
    ).toEqual([['intro'], ['heading', 'title', 'paragraph']]);
  });
  it('uses the larger area on continuation pages and keeps all content in order', () => {
    const blocks = Array.from({ length: 20 }, (_, i) => ({ id: `block-${i}`, height: 20 }));
    const pages = paginate(blocks, 60, 100);
    expect(pages.map((page) => page.length)).toEqual([3, 5, 5, 5, 2]);
    expect(pages.flat()).toEqual(blocks.map((block) => block.id));
  });
  it('can move a larger opening group to a continuation page', () => {
    expect(
      paginate(
        [
          { id: 'heading', height: 10, keepWithNext: true },
          { id: 'text', height: 90 },
        ],
        80,
        120,
      ),
    ).toEqual([[], ['heading', 'text']]);
  });
  it('omits a separator and its spacing when its section moves to a new page', () => {
    expect(
      paginate(
        [
          { id: 'previous-section', height: 80 },
          { id: 'separator', height: 20, keepWithNext: true, hideAtPageStart: true },
          { id: 'heading', height: 10, keepWithNext: true },
          { id: 'entry', height: 85 },
        ],
        100,
        100,
      ),
    ).toEqual([['previous-section'], ['heading', 'entry']]);
  });
  it('retains separators between sections on the same page but drops leading decoration', () => {
    expect(
      paginate(
        [
          { id: 'leading', height: 30, hideAtPageStart: true, keepWithNext: true },
          { id: 'first', height: 20 },
          { id: 'separator', height: 10, hideAtPageStart: true, keepWithNext: true },
          { id: 'heading', height: 10, keepWithNext: true },
          { id: 'entry', height: 20 },
        ],
        100,
        100,
      ),
    ).toEqual([['first', 'separator', 'heading', 'entry']]);
  });
});

describe('shared introduction and column dividers', () => {
  const block = (id: string, height: number, keepWithNext = false) => ({
    id,
    height,
    keepWithNext,
  });
  it('uses the taller intro and reserves the shared divider before both body columns', () => {
    const pages = paginateWithIntro(
      [block('summary', 40)],
      [block('contact', 70)],
      [block('experience', 20), block('later', 20)],
      [block('skills', 20)],
      100,
      120,
      10,
    );
    expect(pages.bodyStartPage).toBe(0);
    expect(pages.main).toEqual([['experience'], ['later']]);
    expect(pages.sidebar).toEqual([['skills']]);
  });
  it('moves the divider and both starts when either first heading group needs more room', () => {
    const pages = paginateWithIntro(
      [block('summary', 70)],
      [],
      [block('heading', 10, true), block('entry', 25)],
      [block('skills', 10)],
      100,
      120,
      10,
    );
    expect(pages.bodyStartPage).toBe(1);
    expect(pages.main).toEqual([[], ['heading', 'entry']]);
    expect(pages.sidebar).toEqual([[], ['skills']]);
  });
  it('finishes a multipage introduction before starting body content', () => {
    const intro = Array.from({ length: 8 }, (_, i) => block(`summary-${i}`, 30));
    const pages = paginateWithIntro(
      intro,
      [block('contact', 20)],
      [block('experience', 20)],
      [block('skills', 20)],
      100,
      120,
      10,
    );
    expect(pages.introMain).toEqual([
      ['summary-0', 'summary-1', 'summary-2'],
      ['summary-3', 'summary-4', 'summary-5', 'summary-6'],
      ['summary-7'],
    ]);
    expect(pages.bodyStartPage).toBe(2);
    expect(pages.main).toEqual([[], [], ['experience']]);
    expect(pages.sidebar).toEqual([[], [], ['skills']]);
    expect(pages.introMain.flat()).toEqual(intro.map((item) => item.id));
  });
  it('omits a shared divider without an introduction or without body content', () => {
    expect(paginateWithIntro([], [], [block('body', 40)], [], 100, 120, 10)).toMatchObject({
      main: [['body']],
      bodyStartPage: null,
    });
    expect(paginateWithIntro([block('summary', 40)], [], [], [], 100, 120, 10)).toMatchObject({
      introMain: [['summary']],
      main: [[]],
      bodyStartPage: null,
    });
  });
  it('synchronises both starts with only an invisible intro gap and no divider', () => {
    const pages = paginateWithIntro(
      [block('summary', 15)],
      [block('contact', 60)],
      [block('experience', 15)],
      [block('skills', 15)],
      100,
      120,
      5,
    );
    expect(pages).toMatchObject({
      bodyStartPage: 0,
      main: [['experience']],
      sidebar: [['skills']],
    });
    const largerGap = paginateWithIntro(
      [block('summary', 15)],
      [block('contact', 60)],
      [block('experience', 15)],
      [block('skills', 15)],
      100,
      120,
      30,
    );
    expect(largerGap).toMatchObject({
      bodyStartPage: 1,
      main: [[], ['experience']],
      sidebar: [[], ['skills']],
    });
  });
  it('reserves only the shared intro gap when both body columns move to a fresh page', () => {
    const pages = paginateWithIntro(
      [block('summary', 70)],
      [],
      [block('heading', 10, true), block('entry', 95)],
      [block('skills', 20)],
      100,
      120,
      25,
      5,
    );
    expect(pages).toMatchObject({
      bodyStartPage: 1,
      main: [[], ['heading', 'entry']],
      sidebar: [[], ['skills']],
    });
  });
});
