import { type Project } from '@cv/core';
import { createPortal } from 'react-dom';
import { Header } from './DocumentHeader';
import { buildRegionBlocks, splitIntroduction, type Block } from './flow-blocks';
import { layoutStyles, pageCount } from './page-layout';
import './print.css';
import {
  connectedTimelineBlocks,
  timelinePageConnections,
  type TimelineConnection,
} from './timeline';
import { useMeasuredPagination } from './useMeasuredPagination';

/**
 * Measure semantic blocks with loaded fonts, then render explicit physical A4 pages.
 * Measurement lives outside the zoomed preview so editor scale cannot change page breaks.
 * `data-ready` marks completed pagination for the shared preview/PDF export workflow.
 */
export function CvPreview({
  project,
  onPageCount,
}: {
  project: Project;
  onPageCount?: (count: number) => void;
}) {
  const showSectionDividers = project.layout.appearance.sectionDividers;
  const compactWithoutSummary =
    project.layout.appearance.compactWithoutSummary &&
    !project.layout.sections.some(
      (section) => section.id === 'summary' && section.enabled && project.cv.summary.length > 0,
    );
  const { intro: introMain, body: main } = splitIntroduction(
    buildRegionBlocks(project, 'main'),
    showSectionDividers,
    compactWithoutSummary,
  );
  const { intro: introSidebar, body: sidebar } = splitIntroduction(
    buildRegionBlocks(project, 'sidebar'),
    showSectionDividers,
    compactWithoutSummary,
  );
  const { measurementRootRef, pages, summaryFragments, ready } = useMeasuredPagination(
    project,
    introMain,
    introSidebar,
    main,
    sidebar,
    onPageCount,
  );
  const mainById = new Map([...introMain, ...main].map((block) => [block.id, block]));
  const sidebarById = new Map([...introSidebar, ...sidebar].map((block) => [block.id, block]));
  for (const fragment of summaryFragments) {
    if (mainById.has(fragment.summaryParagraphId!)) mainById.set(fragment.id, fragment);
    if (sidebarById.has(fragment.summaryParagraphId!)) sidebarById.set(fragment.id, fragment);
  }
  const connectedBlockIds = connectedTimelineBlocks(main);
  const mainConnections = timelinePageConnections(pages.main, main);
  const lineMode = project.layout.appearance.timelineStyle === 'line';
  const count = pageCount(pages);
  const renderBlock = (block: Block, showTimeline = false) => {
    const Tag = block.summaryParagraphId ? 'span' : block.bullet ? 'li' : 'div';
    return (
      <Tag
        className={[
          'cv-block',
          block.summaryParagraphId && 'cv-summary-fragment',
          block.summaryContinues && 'cv-summary-continues',
          block.referenceEnd && 'cv-reference-end',
          block.contactItem && 'cv-contact-item',
          block.contactLast && 'cv-contact-last',
          block.bulletContinuation && 'cv-description-continuation',
          block.bulletContinues && 'cv-description-continues',
          block.divider && !block.introTransition && 'cv-section-divider',
          block.introTransition && 'cv-local-intro-transition',
          block.stationHeading && 'cv-station-heading',
          block.station && `cv-station cv-station-${block.station}`,
          showTimeline && connectedBlockIds.has(block.id) && 'cv-station-connected',
        ]
          .filter(Boolean)
          .join(' ')}
        data-block-id={block.id}
        data-section={block.section}
        key={block.id}
      >
        {(block.station === 'start' || block.station === 'single') &&
          showTimeline &&
          project.layout.appearance.timelineStyle !== 'none' && (
            <span className="cv-station-dot" aria-hidden="true" />
          )}
        {block.content}
      </Tag>
    );
  };
  const renderBlocks = (blocks: Block[], showTimeline = false) => {
    const groups: Block[][] = [];
    for (const block of blocks) {
      const previous = groups.at(-1);
      if (
        (block.bullet && previous?.[0].bullet) ||
        (block.summaryParagraphId && block.summaryParagraphId === previous?.[0].summaryParagraphId)
      )
        previous!.push(block);
      else groups.push([block]);
    }
    return groups.map((group) =>
      group[0].summaryParagraphId ? (
        <p className="cv-summary-paragraph" key={group[0].id}>
          {group.map((block) => renderBlock(block))}
        </p>
      ) : group[0].bullet ? (
        <ul className="cv-description-list" role="list" key={group[0].id}>
          {group.map((block) => renderBlock(block, showTimeline))}
        </ul>
      ) : (
        renderBlock(group[0], showTimeline)
      ),
    );
  };
  const renderTimelineTail = (connection?: TimelineConnection) =>
    lineMode && connection?.toNext && <span className="cv-timeline-tail" aria-hidden="true" />;
  const renderBodyColumns = (
    main: Block[],
    sidebar: Block[],
    mainConnection?: TimelineConnection,
  ) => (
    <>
      <main
        className="cv-main"
        data-timeline-from-previous={(lineMode && mainConnection?.fromPrevious) || undefined}
        data-timeline-to-next={(lineMode && mainConnection?.toNext) || undefined}
      >
        {renderBlocks(main, true)}
        {renderTimelineTail(mainConnection)}
      </main>
      <aside className="cv-sidebar">{renderBlocks(sidebar)}</aside>
    </>
  );
  const renderColumns = (
    main: Block[],
    sidebar: Block[],
    introMain: Block[],
    introSidebar: Block[],
    transition: boolean,
    mainConnection?: TimelineConnection,
  ) => (
    <div className="cv-columns cv-aligned-columns">
      {(introMain.length > 0 || introSidebar.length > 0) && (
        <div className="cv-column-row cv-intro-row">
          <div className="cv-main">{renderBlocks(introMain)}</div>
          <div className="cv-sidebar">{renderBlocks(introSidebar)}</div>
        </div>
      )}
      {transition && (
        <div className="cv-intro-transition" aria-hidden="true">
          {showSectionDividers && (introMain.length > 0 || introSidebar.length > 0) && (
            <div className="cv-wide-divider">
              <hr />
            </div>
          )}
        </div>
      )}
      <div className="cv-column-row cv-body-row">
        {renderBodyColumns(main, sidebar, mainConnection)}
      </div>
    </div>
  );
  const resolvePageBlocks = (ids: string[] = [], byId: Map<string, Block>) =>
    ids.map((id) => byId.get(id)).filter((block): block is Block => !!block);
  const classes = `cv-sidebar-${project.layout.appearance.sidebarSide} cv-timeline-${project.layout.appearance.timelineStyle}`;
  return (
    <div className={`cv-document ${classes}`} style={layoutStyles(project)} data-ready={ready}>
      {createPortal(
        <div
          className={`cv-measure ${classes}`}
          style={layoutStyles(project)}
          ref={measurementRootRef}
          aria-hidden="true"
        >
          <div className="cv-mm" />
          <Header project={project} />
          <Header project={project} continuation />
          {renderColumns(
            main,
            sidebar,
            introMain,
            introSidebar,
            !!(introMain.length || introSidebar.length) && !!(main.length || sidebar.length),
          )}
        </div>,
        document.body,
      )}
      {Array.from({ length: count }, (_, i) => (
        <article
          className={`cv-page${i === 0 ? ' cv-first-page' : ''}`}
          key={i}
          aria-label={`Lebenslauf, Seite ${i + 1} von ${count}`}
        >
          <Header project={project} continuation={i > 0} />
          {renderColumns(
            resolvePageBlocks(pages.main[i], mainById),
            resolvePageBlocks(pages.sidebar[i], sidebarById),
            resolvePageBlocks(pages.introMain[i], mainById),
            resolvePageBlocks(pages.introSidebar[i], sidebarById),
            pages.bodyStartPage === i,
            mainConnections[i],
          )}
          {project.layout.appearance.showFooter && (
            <footer className="cv-footer">
              <span>
                {project.cv.contact.firstName} {project.cv.contact.lastName}
              </span>
              <span>
                {String(i + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
              </span>
            </footer>
          )}
        </article>
      ))}
    </div>
  );
}
