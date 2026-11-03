export interface TimelineBlock {
  id: string;
  section?: string;
  station?: 'start' | 'body' | 'end' | 'single';
}
/** CSS uses these flags to extend a line to both sides of a physical page boundary. */
export interface TimelineConnection {
  fromPrevious: boolean;
  toNext: boolean;
}

// Section identity, rather than entry identity, also connects separate stations.
// Headings, dividers, empty pages and different sections intentionally break the line.
function sharesTimelineSection(before?: TimelineBlock, after?: TimelineBlock): boolean {
  return (
    !!before?.station &&
    !!after?.station &&
    before.section !== undefined &&
    before.section === after.section
  );
}

/**
 * Inspect the actual last/first blocks after pagination, rather than guessing from
 * page fullness. A station can continue mid-description or between two entries.
 * Leading empty pages are significant and must not be filtered from the input.
 */
export function timelinePageConnections(
  pages: string[][],
  blocks: TimelineBlock[],
): TimelineConnection[] {
  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  const connectsPages = (before: string[] = [], after: string[] = []) =>
    sharesTimelineSection(blocksById.get(before[before.length - 1]), blocksById.get(after[0]));
  return pages.map((ids, i) => ({
    fromPrevious: connectsPages(pages[i - 1], ids),
    toNext: connectsPages(ids, pages[i + 1]),
  }));
}

/** Single entries also need a line when they have neighbours in the same section. */
export function connectedTimelineBlocks(blocks: TimelineBlock[]): Set<string> {
  return new Set(
    blocks
      .filter(
        (block, i) =>
          sharesTimelineSection(blocks[i - 1], block) ||
          sharesTimelineSection(block, blocks[i + 1]),
      )
      .map((block) => block.id),
  );
}
