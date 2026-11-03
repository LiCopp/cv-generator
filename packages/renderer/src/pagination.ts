/** A flow unit measured in CSS pixels, including the spacing owned by its wrapper. */
export interface MeasuredBlock {
  id: string;
  height: number;
  /** Look ahead through a heading/title chain before choosing a page break. */
  keepWithNext?: boolean;
  /** Decorative separators contribute neither content nor spacing at a page start. */
  hideAtPageStart?: boolean;
}
/** Arrays share physical page indices, including empty leading pages in shorter regions. */
export interface ColumnPages {
  main: string[][];
  sidebar: string[][];
  introMain: string[][];
  introSidebar: string[][];
  bodyStartPage: number | null;
}

/**
 * Pack measured blocks in document order without orphaning a heading or station title.
 * All heights must use the same CSS-pixel scale, not rounded millimetres.
 * The 0.5-pixel fit tolerance prevents fractional DOM metrics from creating an extra page.
 * Oversized content is still emitted once rather than dropped or retried indefinitely;
 * callers split long descriptions into smaller flow units before measurement.
 */
export function paginate(
  blocks: MeasuredBlock[],
  firstPageHeight: number,
  continuationPageHeight: number,
): string[][] {
  const pages: string[][] = [[]];
  let usedHeight = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.hideAtPageStart && !pages[pages.length - 1].length) continue;
    let groupHeight = block.height;
    let groupEndIndex = i;
    // Look ahead for the break decision, but commit one block at a time so later
    // paragraphs of the same station can continue naturally on following pages.
    while (blocks[groupEndIndex]?.keepWithNext && blocks[groupEndIndex + 1])
      groupHeight += blocks[++groupEndIndex].height;
    let pageCapacity = pages.length === 1 ? firstPageHeight : continuationPageHeight;
    if (pages[pages.length - 1].length && usedHeight + groupHeight > pageCapacity + 0.5) {
      pages.push([]);
      usedHeight = 0;
      pageCapacity = continuationPageHeight;
      if (block.hideAtPageStart) continue;
    }
    if (
      groupHeight > pageCapacity &&
      pages.length === 1 &&
      !pages[0].length &&
      pageCapacity < continuationPageHeight
    ) {
      // A large header can leave too little room on page one. Keep that physical
      // page index empty instead of forcing the opening group into the header.
      pages.push([]);
      usedHeight = 0;
    }
    pages[pages.length - 1].push(block.id);
    usedHeight += block.height;
  }
  return pages;
}

/**
 * Finish both introductory regions before starting the two independent body columns.
 * The taller introduction controls the shared baseline; neither body may start early.
 * On a fresh page only the content gap remains, because the shared divider is omitted.
 * Empty leading arrays retain alignment with the actual document's page indices.
 */
export function paginateWithIntro(
  introMain: MeasuredBlock[],
  introSidebar: MeasuredBlock[],
  main: MeasuredBlock[],
  sidebar: MeasuredBlock[],
  firstPageHeight: number,
  continuationPageHeight: number,
  transitionHeight: number,
  continuationTransitionHeight = transitionHeight,
): ColumnPages {
  const introPages = {
    introMain: paginate(introMain, firstPageHeight, continuationPageHeight),
    introSidebar: paginate(introSidebar, firstPageHeight, continuationPageHeight),
  };
  if (!introMain.length && !introSidebar.length)
    return {
      ...introPages,
      main: paginate(main, firstPageHeight, continuationPageHeight),
      sidebar: paginate(sidebar, firstPageHeight, continuationPageHeight),
      bodyStartPage: null,
    };
  if (!main.length && !sidebar.length)
    return { ...introPages, main: [[]], sidebar: [[]], bodyStartPage: null };
  let bodyStartPage = Math.max(introPages.introMain.length, introPages.introSidebar.length) - 1;
  const heightOnPage = (blocks: MeasuredBlock[], ids: string[] = []) => {
    const selected = new Set(ids);
    return blocks.reduce((sum, block) => sum + (selected.has(block.id) ? block.height : 0), 0);
  };
  const usedHeight = Math.max(
    heightOnPage(introMain, introPages.introMain[bodyStartPage]),
    heightOnPage(introSidebar, introPages.introSidebar[bodyStartPage]),
  );
  const openingGroupHeight = (blocks: MeasuredBlock[]) => {
    let height = 0;
    for (const block of blocks) {
      height += block.height;
      if (!block.keepWithNext) break;
    }
    return height;
  };
  let availableBodyHeight =
    (bodyStartPage === 0 ? firstPageHeight : continuationPageHeight) -
    usedHeight -
    transitionHeight;
  // Move both bodies when either opening group cannot fit. Subsequent breaks are
  // independent, so a long work history does not insert gaps in the sidebar.
  if (Math.max(openingGroupHeight(main), openingGroupHeight(sidebar)) > availableBodyHeight + 0.5) {
    bodyStartPage++;
    availableBodyHeight = continuationPageHeight - continuationTransitionHeight;
  }
  const alignBodyPageIndices = (pages: string[][]) => [
    ...Array.from({ length: bodyStartPage }, () => [] as string[]),
    ...pages,
  ];
  return {
    ...introPages,
    bodyStartPage,
    main: alignBodyPageIndices(paginate(main, availableBodyHeight, continuationPageHeight)),
    sidebar: alignBodyPageIndices(paginate(sidebar, availableBodyHeight, continuationPageHeight)),
  };
}
