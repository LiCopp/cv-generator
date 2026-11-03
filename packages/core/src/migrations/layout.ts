import { contactFieldIds, headingIds, headingLabels, stationHeadingFields } from '../sections';
import { defaultSkillsLayout } from '../skills';

/** Keep each historical appearance default tied to the version that introduced it. */
export function migrateLayoutResource(project: Record<string, unknown>): Record<string, unknown> {
  const layout = project.layout;
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) return project;
  let upgradedLayout = layout as Record<string, unknown>;
  const appearance = upgradedLayout.appearance;
  if (!appearance || typeof appearance !== 'object' || Array.isArray(appearance)) return project;
  // Do not reinterpret unknown fields or silently overwrite data supplied by an import.
  if (upgradedLayout.schemaVersion === 1) {
    if (
      ['headerEdge', 'headerEdgeDepthMm', 'timelineStyle', 'timelineOffsetMm'].some(
        (key) => key in appearance,
      )
    )
      throw new Error('Das Layout enthält Felder, die nicht zu Version 1 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 2,
      appearance: {
        ...appearance,
        headerEdge: 'straight',
        headerEdgeDepthMm: 10,
        timelineStyle: 'none',
      },
    };
  }
  if (upgradedLayout.schemaVersion === 2) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if ('timelineOffsetMm' in previousAppearance)
      throw new Error('Das Layout enthält Felder, die nicht zu Version 2 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 3,
      appearance: { ...previousAppearance, timelineOffsetMm: 0 },
    };
  }
  if (upgradedLayout.schemaVersion === 3) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if (
      ['photoSide', 'photoOverlapMm', 'headerImageAssetId', 'headerImageDimPercent'].some(
        (key) => key in previousAppearance,
      )
    )
      throw new Error('Das Layout enthält Felder, die nicht zu Version 3 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 4,
      appearance: {
        ...previousAppearance,
        photoSide: 'right',
        photoOverlapMm: 0,
        headerImageAssetId: null,
        headerImageDimPercent: 25,
      },
    };
  }
  if (upgradedLayout.schemaVersion === 4) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if (
      [
        'photoWidthMm',
        'photoBorderWidthMm',
        'photoBorderColor',
        'photoFit',
        'photoPositionX',
        'photoPositionY',
      ].some((key) => key in previousAppearance)
    )
      throw new Error('Das Layout enthält Felder, die nicht zu Version 4 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 5,
      appearance: {
        ...previousAppearance,
        photoWidthMm: 34,
        photoBorderWidthMm: 1.2,
        photoBorderColor: '#ffffff',
        photoFit: 'cover',
        photoPositionX: 50,
        photoPositionY: 50,
      },
    };
  }
  if (upgradedLayout.schemaVersion === 5) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if ('headerEdgeMirrored' in previousAppearance)
      throw new Error('Das Layout enthält Felder, die nicht zu Version 5 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 6,
      appearance: { ...previousAppearance, headerEdgeMirrored: false },
    };
  }
  if (upgradedLayout.schemaVersion === 6) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if ('headerImageTransparencyPercent' in previousAppearance)
      throw new Error('Das Layout enthält Felder, die nicht zu Version 6 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 7,
      appearance: { ...previousAppearance, headerImageTransparencyPercent: 0 },
    };
  }
  if (upgradedLayout.schemaVersion === 7) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if (['timelineTextGapMm', 'stationSpacingMm'].some((key) => key in previousAppearance))
      throw new Error('Das Layout enthält Felder, die nicht zu Version 7 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 8,
      appearance: { ...previousAppearance, timelineTextGapMm: 3.75, stationSpacingMm: 1.5 },
    };
  }
  if (upgradedLayout.schemaVersion === 8) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if ('sectionDividers' in previousAppearance)
      throw new Error('Das Layout enthält Felder, die nicht zu Version 8 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 9,
      appearance: { ...previousAppearance, sectionDividers: false },
    };
  }
  if (upgradedLayout.schemaVersion === 9) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if (
      ['dividerSpacingBeforeMm', 'dividerSpacingAfterMm', 'dividerLengthPercent'].some(
        (key) => key in previousAppearance,
      )
    )
      throw new Error('Das Layout enthält Felder, die nicht zu Version 9 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 10,
      appearance: {
        ...previousAppearance,
        dividerSpacingBeforeMm: previousAppearance.spacingMm,
        dividerSpacingAfterMm: previousAppearance.spacingMm,
        dividerLengthPercent: null,
      },
    };
  }
  if (upgradedLayout.schemaVersion === 10) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if (['headerContentGapMm', 'introBodyGapMm'].some((key) => key in previousAppearance))
      throw new Error('Das Layout enthält Felder, die nicht zu Version 10 gehören.');
    const oldPage = upgradedLayout.page;
    const margin =
      oldPage && typeof oldPage === 'object' && !Array.isArray(oldPage)
        ? (oldPage as Record<string, unknown>).marginMm
        : undefined;
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 11,
      appearance: {
        ...previousAppearance,
        headerContentGapMm: margin,
        introBodyGapMm: previousAppearance.spacingMm,
      },
    };
  }
  if (upgradedLayout.schemaVersion === 11) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if ('sectionHeadings' in previousAppearance)
      throw new Error('Das Layout enthält Felder, die nicht zu Version 11 gehören.');
    const sectionHeadings = Object.fromEntries(
      headingIds
        .filter((id) => id !== 'references')
        .map((id) => [id, { title: headingLabels[id], fontSizePt: 9 }]),
    );
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 12,
      appearance: { ...previousAppearance, sectionHeadings },
    };
  }
  if (upgradedLayout.schemaVersion === 12) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if ('showContactHeading' in previousAppearance)
      throw new Error('Das Layout enthält Felder, die nicht zu Version 12 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 13,
      appearance: { ...previousAppearance, showContactHeading: true },
    };
  }
  if (upgradedLayout.schemaVersion === 13) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if (['showRunningHeader', 'showFooter'].some((key) => key in previousAppearance))
      throw new Error('Das Layout enthält Felder, die nicht zu Version 13 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 14,
      appearance: { ...previousAppearance, showRunningHeader: true, showFooter: true },
    };
  }
  if (upgradedLayout.schemaVersion === 14) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    const additions = {
      introDividerSpacingBeforeMm: previousAppearance.dividerSpacingBeforeMm,
      introDividerSpacingAfterMm: previousAppearance.dividerSpacingAfterMm,
      contactOrder: [...contactFieldIds],
      contactLineHeight: 1.55,
      contactSpacingMm: 2.8,
      stationDateLineHeight: previousAppearance.lineHeight,
      stationTitleLineHeight: 1.4,
      stationOrganizationLineHeight: previousAppearance.lineHeight,
      stationDateTitleGapMm: 0.9,
      stationTitleOrganizationGapMm: 0.5,
    };
    if (Object.keys(additions).some((key) => key in previousAppearance))
      throw new Error('Das Layout enthält Felder, die nicht zu Version 14 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 15,
      appearance: { ...previousAppearance, ...additions },
    };
  }
  if (upgradedLayout.schemaVersion === 15) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    const headings = previousAppearance.sectionHeadings;
    if (
      Array.isArray(upgradedLayout.sections) &&
      headings &&
      typeof headings === 'object' &&
      !Array.isArray(headings)
    ) {
      if (
        'references' in headings ||
        upgradedLayout.sections.some(
          (section) => section && typeof section === 'object' && section.id === 'references',
        )
      )
        throw new Error('Das Layout enthält Abschnitte, die nicht zu Version 15 gehören.');
      const regions = (project.template as { regions?: unknown } | undefined)?.regions;
      const region = Array.isArray(regions) && regions.includes('sidebar') ? 'sidebar' : 'main';
      upgradedLayout = {
        ...upgradedLayout,
        schemaVersion: 16,
        sections: [...upgradedLayout.sections, { id: 'references', region, enabled: true }],
        appearance: {
          ...previousAppearance,
          sectionHeadings: { ...headings, references: { title: 'Referenzen', fontSizePt: 9 } },
        },
      };
    }
  }
  if (upgradedLayout.schemaVersion === 16) {
    if ('skills' in upgradedLayout)
      throw new Error('Das Layout enthält Felder, die nicht zu Version 16 gehören.');
    upgradedLayout = { ...upgradedLayout, schemaVersion: 17, skills: defaultSkillsLayout() };
  }
  // Import resolves optional presentation settings; the editor/domain use complete values.
  if (
    upgradedLayout.schemaVersion === 17 ||
    upgradedLayout.schemaVersion === 18 ||
    upgradedLayout.schemaVersion === 19 ||
    upgradedLayout.schemaVersion === 20 ||
    upgradedLayout.schemaVersion === 21 ||
    upgradedLayout.schemaVersion === 22 ||
    upgradedLayout.schemaVersion === 23
  ) {
    const skills = upgradedLayout.skills;
    if (skills === undefined) upgradedLayout = { ...upgradedLayout, skills: defaultSkillsLayout() };
    else if (skills && typeof skills === 'object' && !Array.isArray(skills))
      upgradedLayout = {
        ...upgradedLayout,
        skills: {
          ...defaultSkillsLayout(),
          showDescription: (skills as Record<string, unknown>).display === 'detailed',
          ...skills,
        },
      };
  }
  if (upgradedLayout.schemaVersion === 17) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if (['headerShiftUpMm', 'headerTextColor'].some((key) => key in previousAppearance))
      throw new Error('Das Layout enthält Felder, die nicht zu Version 17 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 18,
      appearance: { ...previousAppearance, headerShiftUpMm: 0, headerTextColor: '#ffffff' },
    };
  }
  if (upgradedLayout.schemaVersion === 18) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if (
      ['headerNameLayout', 'stationHeadingOrder', 'leftColumnLineHeight'].some(
        (key) => key in previousAppearance,
      )
    )
      throw new Error('Das Layout enthält Felder, die nicht zu Version 18 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 19,
      appearance: {
        ...previousAppearance,
        headerNameLayout: 'stacked',
        stationHeadingOrder: [...stationHeadingFields],
        leftColumnLineHeight: null,
      },
    };
  }
  if (upgradedLayout.schemaVersion === 19) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if ('headerTextOffsetMm' in previousAppearance)
      throw new Error('Das Layout enthält Felder, die nicht zu Version 19 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 20,
      appearance: { ...previousAppearance, headerTextOffsetMm: 0 },
    };
  }
  if (upgradedLayout.schemaVersion === 20) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if ('photoOffsetMm' in previousAppearance)
      throw new Error('Das Layout enthält Felder, die nicht zu Version 20 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 21,
      appearance: { ...previousAppearance, photoOffsetMm: 0 },
    };
  }
  if (upgradedLayout.schemaVersion === 21) {
    const previousAppearance = upgradedLayout.appearance as Record<string, unknown>;
    if ('compactWithoutSummary' in previousAppearance)
      throw new Error('Das Layout enthält Felder, die nicht zu Version 21 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 22,
      appearance: { ...previousAppearance, compactWithoutSummary: false },
    };
  }
  if (upgradedLayout.schemaVersion === 22) {
    if ('proficiencyPercentages' in upgradedLayout)
      throw new Error('Das Layout enthält Felder, die nicht zu Version 22 gehören.');
    upgradedLayout = {
      ...upgradedLayout,
      schemaVersion: 23,
      proficiencyPercentages: { skills: {}, languages: {} },
    };
  }
  return { ...project, layout: upgradedLayout };
}
