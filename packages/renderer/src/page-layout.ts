import { fontRegistry, type Project } from '@cv/core';
import { type CSSProperties } from 'react';
import { headerClipPath } from './header';
import { type ColumnPages } from './pagination';

export const pageCount = (pages: ColumnPages) =>
  Math.max(
    pages.main.length,
    pages.sidebar.length,
    pages.introMain.length,
    pages.introSidebar.length,
    (pages.bodyStartPage ?? -1) + 1,
  );

export const footerSpaceMm = (project: Project) => (project.layout.appearance.showFooter ? 8 : 0);

/**
 * Resolve validated, portable layout values into the renderer's CSS-variable contract.
 * Physical lengths stay in mm/pt; the same mapping is used by hidden measurement,
 * visible A4 pages and the print snapshot. Keep derived geometry here rather than in MUI.
 */
export function layoutStyles(project: Project): CSSProperties {
  const { appearance, page } = project.layout;
  return {
    '--cv-accent': appearance.accent,
    '--cv-font': fontRegistry[appearance.fontId].family,
    '--cv-font-size': `${appearance.fontSizePt}pt`,
    '--cv-line-height': appearance.lineHeight,
    '--cv-left-line-height': appearance.leftColumnLineHeight ?? appearance.lineHeight,
    '--cv-gap': `${appearance.spacingMm}mm`,
    '--cv-margin': `${page.marginMm}mm`,
    '--cv-footer-space': `${footerSpaceMm(project)}mm`,
    '--cv-sidebar': `${appearance.sidebarPercent}%`,
    '--cv-timeline-offset': `${appearance.timelineOffsetMm}mm`,
    '--cv-timeline-text-gap': `${appearance.timelineTextGapMm}mm`,
    '--cv-station-spacing': `${appearance.stationSpacingMm}mm`,
    '--cv-divider-before': `${appearance.dividerSpacingBeforeMm}mm`,
    '--cv-divider-after': `${appearance.dividerSpacingAfterMm}mm`,
    '--cv-intro-divider-before': `${appearance.introDividerSpacingBeforeMm}mm`,
    '--cv-intro-divider-after': `${appearance.introDividerSpacingAfterMm}mm`,
    '--cv-contact-line-height': appearance.contactLineHeight,
    '--cv-contact-spacing': `${appearance.contactSpacingMm}mm`,
    '--cv-station-date-line-height': appearance.stationDateLineHeight,
    '--cv-station-title-line-height': appearance.stationTitleLineHeight,
    '--cv-station-organization-line-height': appearance.stationOrganizationLineHeight,
    '--cv-date-title-gap': `${appearance.stationDateTitleGapMm}mm`,
    '--cv-title-organization-gap': `${appearance.stationTitleOrganizationGapMm}mm`,
    '--cv-divider-length': `${appearance.dividerLengthPercent ?? 100}%`,
    '--cv-header-gap': `${appearance.headerContentGapMm}mm`,
    '--cv-header-shift': `${appearance.headerShiftUpMm}mm`,
    '--cv-header-text-offset': `${appearance.headerTextOffsetMm}mm`,
    '--cv-header-text-color': appearance.headerTextColor,
    '--cv-intro-gap': `${appearance.introBodyGapMm}mm`,
    '--cv-edge-depth':
      appearance.headerEdge === 'straight' ? '0mm' : `${appearance.headerEdgeDepthMm}mm`,
    '--cv-header-clip': headerClipPath(
      appearance.headerEdge,
      appearance.headerEdgeDepthMm,
      appearance.headerEdgeMirrored,
    ),
    '--cv-photo-overlap': `${appearance.photoOverlapMm}mm`,
    '--cv-photo-offset': `${appearance.photoOffsetMm}mm`,
    '--cv-image-dim': appearance.headerImageDimPercent / 100,
    '--cv-image-opacity': 1 - appearance.headerImageTransparencyPercent / 100,
    '--cv-photo-width': `${appearance.photoWidthMm}mm`,
    '--cv-photo-height': `${appearance.photoShape === 'circle' ? appearance.photoWidthMm : (appearance.photoWidthMm * 40) / 34}mm`,
    '--cv-photo-border-width': `${appearance.photoBorderWidthMm}mm`,
    '--cv-photo-border-color': appearance.photoBorderColor,
    '--cv-photo-fit': appearance.photoFit,
    '--cv-photo-position': `${appearance.photoPositionX}% ${appearance.photoPositionY}%`,
  } as CSSProperties;
}
