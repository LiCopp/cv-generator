import { describe, expect, it } from 'vitest';
import { connectedTimelineBlocks, timelinePageConnections, type TimelineBlock } from './timeline';

describe('timeline continuation', () => {
  it('joins descriptions and later entries within the same section across page breaks', () => {
    const blocks: TimelineBlock[] = [
      { id: 'heading', section: 'experience' },
      { id: 'title', section: 'experience', station: 'start' },
      { id: 'description', section: 'experience', station: 'end' },
      { id: 'next-job', section: 'experience', station: 'single' },
    ];
    expect(
      timelinePageConnections([['heading', 'title'], ['description'], ['next-job']], blocks),
    ).toEqual([
      { fromPrevious: false, toNext: true },
      { fromPrevious: true, toNext: true },
      { fromPrevious: true, toNext: false },
    ]);
    expect([...connectedTimelineBlocks(blocks)]).toEqual(['title', 'description', 'next-job']);
  });
  it('does not continue across a section boundary, separator, empty page or after the final entry', () => {
    const blocks: TimelineBlock[] = [
      { id: 'job', section: 'experience', station: 'single' },
      { id: 'divider' },
      { id: 'school', section: 'education', station: 'single' },
    ];
    for (const pages of [
      [['job'], ['school']],
      [['job'], ['divider', 'school']],
      [['job'], [], ['school']],
    ]) {
      expect(timelinePageConnections(pages, blocks)).toEqual(
        pages.map(() => ({ fromPrevious: false, toNext: false })),
      );
    }
    expect([...connectedTimelineBlocks(blocks)]).toEqual([]);
  });
  it('connects single entries to their neighbours without adding lines to isolated stations', () => {
    const blocks: TimelineBlock[] = [
      { id: 'first', section: 'experience', station: 'single' },
      { id: 'second', section: 'experience', station: 'single' },
      { id: 'heading', section: 'education' },
      { id: 'school', section: 'education', station: 'single' },
    ];
    expect([...connectedTimelineBlocks(blocks)]).toEqual(['first', 'second']);
    expect(timelinePageConnections([['first'], ['second', 'heading', 'school']], blocks)).toEqual([
      { fromPrevious: false, toNext: true },
      { fromPrevious: true, toNext: false },
    ]);
  });
});
