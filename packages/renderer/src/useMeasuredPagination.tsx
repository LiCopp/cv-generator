import type { Project } from '@cv/core';
import { useLayoutEffect, useRef, useState } from 'react';
import type { Block } from './flow-blocks';
import { footerSpaceMm, pageCount } from './page-layout';
import { paginateWithIntro, type ColumnPages } from './pagination';
import { measureSummaryFragments } from './summary';

/** Measure unscaled semantic blocks after fonts load, cancelling stale measurements. */
export function useMeasuredPagination(
  project: Project,
  introMain: Block[],
  introSidebar: Block[],
  main: Block[],
  sidebar: Block[],
  onPageCount?: (count: number) => void,
) {
  const measurementRootRef = useRef<HTMLDivElement>(null);
  const [{ pages, summaryFragments }, setPagination] = useState<{
    pages: ColumnPages;
    summaryFragments: Block[];
  }>({
    pages: {
      main: [[]],
      sidebar: [[]],
      introMain: [],
      introSidebar: [],
      bodyStartPage: null,
    },
    summaryFragments: [],
  });
  const [ready, setReady] = useState(false);

  const projectFingerprint = JSON.stringify(project);

  useLayoutEffect(() => {
    let cancelled = false;
    setReady(false);
    const measurePagination = () => {
      if (cancelled || !measurementRootRef.current) return;
      const root = measurementRootRef.current;
      // Read a real CSS-mm probe instead of assuming 96 px/in. All measured blocks
      // and page capacities must share the browser's current physical-unit scale.
      const pixelsPerMm = root.querySelector<HTMLElement>('.cv-mm')!.getBoundingClientRect().height;
      const headerHeight = root
        .querySelector<HTMLElement>('.cv-header-viewport')!
        .getBoundingClientRect().height;
      const runningHeaderHeight =
        root.querySelector<HTMLElement>('.cv-running-header')?.getBoundingClientRect().height ?? 0;
      const pageMarginHeight = project.layout.page.marginMm * pixelsPerMm;
      const footerHeight = footerSpaceMm(project) * pixelsPerMm;
      // Page one spends its top area on the full header and explicit content gap.
      // Later pages reserve two margins and only the optional running header.
      const firstPageContentHeight =
        297 * pixelsPerMm -
        headerHeight -
        pageMarginHeight -
        project.layout.appearance.headerContentGapMm * pixelsPerMm -
        footerHeight;
      const continuationContentHeight =
        297 * pixelsPerMm - runningHeaderHeight - pageMarginHeight * 2 - footerHeight;
      const nextSummaryFragments: Block[] = [];
      const measureBlocks = (region: 'main' | 'sidebar', blocks: Block[], row = '') => {
        // DOM order must match buildRegionBlocks exactly. Wrapper height already
        // includes owned spacing; counting separate margins here would double it.
        const nodes = root.querySelectorAll<HTMLElement>(`${row} .cv-${region} .cv-block`);
        return blocks.flatMap((block, i) => {
          const height = nodes[i].getBoundingClientRect().height;
          if (block.summaryText !== undefined) {
            const paragraph = nodes[i].querySelector('p')!;
            const fragments = measureSummaryFragments(paragraph);
            const padding = height - paragraph.getBoundingClientRect().height;
            return fragments.map((fragment, index) => {
              const continues = index < fragments.length - 1;
              const id = index ? `${block.id}-part-${index}` : block.id;
              nextSummaryFragments.push({
                ...block,
                id,
                summaryParagraphId: block.id,
                summaryContinues: continues,
                content: fragment.lines.map((text, line) => (
                  <span className="cv-summary-line" key={line}>
                    {text.trimEnd()}
                    {text.length > text.trimEnd().length && (
                      <span className="cv-summary-whitespace">
                        {text.slice(text.trimEnd().length)}
                      </span>
                    )}
                  </span>
                )),
              });
              return { id, height: fragment.height + (continues ? 0 : padding) };
            });
          }
          return [
            {
              id: block.id,
              keepWithNext: block.keepWithNext,
              hideAtPageStart: block.divider,
              height,
            },
          ];
        });
      };
      const nextPages = paginateWithIntro(
        measureBlocks('main', introMain, '.cv-intro-row'),
        measureBlocks('sidebar', introSidebar, '.cv-intro-row'),
        measureBlocks('main', main, '.cv-body-row'),
        measureBlocks('sidebar', sidebar, '.cv-body-row'),
        firstPageContentHeight,
        continuationContentHeight,
        root.querySelector<HTMLElement>('.cv-intro-transition')?.getBoundingClientRect().height ??
          0,
        project.layout.appearance.introBodyGapMm * pixelsPerMm,
      );
      setPagination({ pages: nextPages, summaryFragments: nextSummaryFragments });
      setReady(true);
      onPageCount?.(pageCount(nextPages));
    };
    void document.fonts.ready.then(measurePagination);
    return () => {
      cancelled = true;
    };
    // A value fingerprint avoids remeasuring for object-identity-only renders.
    // Font readiness and cancellation prevent stale measurements from committing.
  }, [projectFingerprint]);

  return { measurementRootRef, pages, summaryFragments, ready };
}
