import { withoutNewReferences } from './legacy-test-fixtures';
import { describe, expect, it } from 'vitest';
import { createProject, studentProject } from './fixtures';
import {
  contactFieldIds,
  datePrecision,
  dateSchema,
  headingIds,
  headingLabels,
  layoutSchema,
  parseProject,
  projectSchema,
  type Cv,
  type Project,
} from './schema';

function independentSpacingDefaults(project: Project) {
  return {
    introDividerSpacingBeforeMm: project.layout.appearance.dividerSpacingBeforeMm,
    introDividerSpacingAfterMm: project.layout.appearance.dividerSpacingAfterMm,
    contactOrder: [...contactFieldIds],
    contactLineHeight: 1.55,
    contactSpacingMm: 2.8,
    stationDateLineHeight: project.layout.appearance.lineHeight,
    stationTitleLineHeight: 1.4,
    stationOrganizationLineHeight: project.layout.appearance.lineHeight,
    stationDateTitleGapMm: 0.9,
    stationTitleOrganizationGapMm: 0.5,
  };
}

function historicalProject(kind: 'student' | 'adult') {
  const project = createProject(kind);
  for (const section of ['education', 'experience', 'projects'] as const) {
    for (const entry of project.cv[section]) {
      for (const key of ['start', 'end'] as const) {
        const value = entry[key];
        if (value) {
          const { day, ...oldDate } = value;
          entry[key] = oldDate;
        }
        entry[`${key}Precision`] = datePrecision(entry[key]);
      }
    }
  }
  return project;
}
function legacyEntries(cv: Cv) {
  return Object.fromEntries(
    ['education', 'experience', 'projects'].map((section) => [
      section,
      cv[section as 'education'].map(({ startPrecision, endPrecision, ...entry }) => entry),
    ]),
  );
}

describe('versioned project model', () => {
  it('migrates v14 with the previous contact order, header line spacing and station typography', () => {
    const project = createProject('adult');
    Object.assign(project.layout.appearance, {
      lineHeight: 1.8,
      dividerSpacingBeforeMm: 2,
      dividerSpacingAfterMm: 12,
    });
    const additions = independentSpacingDefaults(project);
    const appearance = Object.fromEntries(
      Object.entries(project.layout.appearance).filter(([key]) => !(key in additions)),
    );
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 14, appearance },
    });
    const migrated = parseProject(JSON.stringify(legacy));
    expect(migrated).toEqual({
      ...project,
      layout: { ...project.layout, appearance: { ...project.layout.appearance, ...additions } },
    });
    expect(parseProject(JSON.stringify(migrated))).toEqual(migrated);
    for (const [key, value] of Object.entries(additions))
      expect(() =>
        parseProject(
          JSON.stringify({
            ...legacy,
            layout: { ...legacy.layout, appearance: { ...appearance, [key]: value } },
          }),
        ),
      ).toThrow('Version 14');
  });
  it('validates complete contact permutations and independent spacing ranges', () => {
    const project = createProject('student');
    project.layout.appearance.contactOrder.reverse();
    Object.assign(project.layout.appearance, {
      contactLineHeight: 2.4,
      contactSpacingMm: 8,
      introDividerSpacingBeforeMm: 0,
      introDividerSpacingAfterMm: 15,
      stationDateLineHeight: 1,
      stationTitleLineHeight: 2.4,
      stationOrganizationLineHeight: 1.9,
      stationDateTitleGapMm: 0,
      stationTitleOrganizationGapMm: 8,
    });
    expect(parseProject(JSON.stringify(project))).toEqual(project);
    for (const contactOrder of [
      contactFieldIds.slice(1),
      [...contactFieldIds, 'email'],
      contactFieldIds.map(() => 'email'),
      [...contactFieldIds.slice(1), 'unknown'],
    ])
      expect(
        layoutSchema.safeParse({
          ...project.layout,
          appearance: { ...project.layout.appearance, contactOrder },
        }).success,
      ).toBe(false);
    for (const [key, value] of Object.entries({
      contactLineHeight: 0.9,
      contactSpacingMm: 8.1,
      introDividerSpacingBeforeMm: -1,
      introDividerSpacingAfterMm: 16,
      stationDateLineHeight: 2.5,
      stationTitleLineHeight: 0,
      stationOrganizationLineHeight: '1.5',
      stationDateTitleGapMm: -0.1,
      stationTitleOrganizationGapMm: 9,
    }))
      expect(
        layoutSchema.safeParse({
          ...project.layout,
          appearance: { ...project.layout.appearance, [key]: value },
        }).success,
      ).toBe(false);
  });
  it('migrates layout v13 with visible running header and footer without changing other settings', () => {
    const project = createProject('adult');
    project.layout.appearance.sectionHeadings.experience = {
      title: 'Berufserfahrung',
      fontSizePt: 12,
    };
    project.layout.appearance.showContactHeading = false;
    project.layout.appearance.headerContentGapMm = 7;
    const {
      showRunningHeader,
      showFooter,
      introDividerSpacingBeforeMm,
      introDividerSpacingAfterMm,
      contactOrder,
      contactLineHeight,
      contactSpacingMm,
      stationDateLineHeight,
      stationTitleLineHeight,
      stationOrganizationLineHeight,
      stationDateTitleGapMm,
      stationTitleOrganizationGapMm,
      ...appearance
    } = project.layout.appearance;
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 13, appearance },
    });
    expect(parseProject(JSON.stringify(legacy))).toEqual(project);
    for (const field of ['showRunningHeader', 'showFooter']) {
      expect(() =>
        parseProject(
          JSON.stringify({
            ...legacy,
            layout: { ...legacy.layout, appearance: { ...appearance, [field]: false } },
          }),
        ),
      ).toThrow('Version 13');
    }
  });
  it('round-trips independent running header and footer visibility and validates their types', () => {
    const project = createProject('student');
    for (const showRunningHeader of [true, false])
      for (const showFooter of [true, false]) {
        Object.assign(project.layout.appearance, { showRunningHeader, showFooter });
        expect(parseProject(JSON.stringify(project))).toEqual(project);
      }
    for (const field of ['showRunningHeader', 'showFooter'])
      for (const value of ['false', 0, null, undefined]) {
        expect(
          layoutSchema.safeParse({
            ...project.layout,
            appearance: { ...project.layout.appearance, [field]: value },
          }).success,
        ).toBe(false);
      }
  });
  it('migrates CV v3 and layout v12 independently without inventing a birthday or hiding headings', () => {
    const project = createProject('adult');
    const { birthDate, ...contact } = project.cv.contact;
    const {
      showContactHeading,
      showRunningHeader,
      showFooter,
      introDividerSpacingBeforeMm,
      introDividerSpacingAfterMm,
      contactOrder,
      contactLineHeight,
      contactSpacingMm,
      stationDateLineHeight,
      stationTitleLineHeight,
      stationOrganizationLineHeight,
      stationDateTitleGapMm,
      stationTitleOrganizationGapMm,
      ...appearance
    } = project.layout.appearance;
    const legacy = withoutNewReferences({
      ...project,
      cv: { ...project.cv, schemaVersion: 3, contact },
      layout: { ...project.layout, schemaVersion: 12, appearance },
    });
    expect(parseProject(JSON.stringify(legacy))).toEqual(project);
    expect(() =>
      parseProject(JSON.stringify({ ...project, cv: { ...project.cv, schemaVersion: 3 } })),
    ).toThrow('Version 3');
    expect(() =>
      parseProject(
        JSON.stringify({ ...project, layout: { ...project.layout, schemaVersion: 12 } }),
      ),
    ).toThrow('Version 12');
  });
  it('retains an optional full birthday and independently hidden contact heading', () => {
    const project = createProject('student');
    project.cv.contact.birthDate = { year: 2000, month: 2, day: 29 };
    project.layout.appearance.showContactHeading = false;
    project.layout.appearance.sectionHeadings.contact = {
      title: 'Persönliche Angaben',
      fontSizePt: 14,
    };
    expect(parseProject(JSON.stringify(project))).toEqual(project);
    project.cv.contact.birthDate = null;
    expect(parseProject(JSON.stringify(project))).toEqual(project);
    for (const birthDate of [
      { year: 2000 },
      { year: 2000, month: 2 },
      { year: 2001, month: 2, day: 29 },
      { year: 2000, month: 4, day: 31 },
      '2000-02-29',
    ]) {
      expect(
        projectSchema.safeParse({
          ...project,
          cv: { ...project.cv, contact: { ...project.cv.contact, birthDate } },
        }).success,
      ).toBe(false);
    }
    expect(
      layoutSchema.safeParse({
        ...project.layout,
        appearance: { ...project.layout.appearance, showContactHeading: 'false' },
      }).success,
    ).toBe(false);
  });
  it('migrates v11 headings with their previous labels and size without changing content', () => {
    const project = createProject('adult');
    const {
      sectionHeadings,
      showContactHeading,
      showRunningHeader,
      showFooter,
      introDividerSpacingBeforeMm,
      introDividerSpacingAfterMm,
      contactOrder,
      contactLineHeight,
      contactSpacingMm,
      stationDateLineHeight,
      stationTitleLineHeight,
      stationOrganizationLineHeight,
      stationDateTitleGapMm,
      stationTitleOrganizationGapMm,
      ...appearance
    } = project.layout.appearance;
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 11, appearance },
    });
    expect(parseProject(JSON.stringify(legacy))).toEqual(project);
    for (const id of headingIds)
      expect(project.layout.appearance.sectionHeadings[id]).toEqual({
        title: headingLabels[id],
        fontSizePt: 9,
      });
    expect(() =>
      parseProject(
        JSON.stringify({ ...project, layout: { ...project.layout, schemaVersion: 11 } }),
      ),
    ).toThrow('Version 11');
  });
  it('round-trips all custom headings, blank fallbacks and independent sizes after reordering', () => {
    const project = createProject('student');
    headingIds.forEach((id, i) => {
      project.layout.appearance.sectionHeadings[id] = {
        title: i % 2 ? '' : `Eigener Titel ${i + 1}`,
        fontSizePt: i % 2 ? 8 : 20,
      };
    });
    project.layout.sections.reverse();
    project.layout.sections[0].region = 'main';
    expect(parseProject(JSON.stringify(project))).toEqual(project);
    for (const heading of [
      { title: 'x'.repeat(121), fontSizePt: 9 },
      { title: 'Titel', fontSizePt: 7.9 },
      { title: 'Titel', fontSizePt: 20.1 },
      { title: 'Titel', fontSizePt: '12pt' },
      { title: 'Titel', fontSizePt: 12, unexpected: true },
    ]) {
      expect(
        layoutSchema.safeParse({
          ...project.layout,
          appearance: {
            ...project.layout.appearance,
            sectionHeadings: { ...project.layout.appearance.sectionHeadings, experience: heading },
          },
        }).success,
      ).toBe(false);
    }
    const { contact, ...missingContact } = project.layout.appearance.sectionHeadings;
    expect(
      layoutSchema.safeParse({
        ...project.layout,
        appearance: { ...project.layout.appearance, sectionHeadings: missingContact },
      }).success,
    ).toBe(false);
  });
  it('migrates v10 with the previous header gap and a separate shared intro gap', () => {
    const project = createProject('adult');
    project.layout.page.marginMm = 22;
    Object.assign(project.layout.appearance, {
      spacingMm: 7,
      dividerSpacingBeforeMm: 2,
      dividerSpacingAfterMm: 12,
      dividerLengthPercent: 60,
    });
    const {
      headerContentGapMm,
      introBodyGapMm,
      sectionHeadings,
      showContactHeading,
      showRunningHeader,
      showFooter,
      introDividerSpacingBeforeMm,
      introDividerSpacingAfterMm,
      contactOrder,
      contactLineHeight,
      contactSpacingMm,
      stationDateLineHeight,
      stationTitleLineHeight,
      stationOrganizationLineHeight,
      stationDateTitleGapMm,
      stationTitleOrganizationGapMm,
      ...appearance
    } = project.layout.appearance;
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 10, appearance },
    });
    const migrated = parseProject(JSON.stringify(legacy));
    expect(migrated).toEqual({
      ...project,
      layout: {
        ...project.layout,
        appearance: {
          ...project.layout.appearance,
          headerContentGapMm: 22,
          introBodyGapMm: 7,
          introDividerSpacingBeforeMm: 2,
          introDividerSpacingAfterMm: 12,
        },
      },
    });
    expect(parseProject(JSON.stringify(migrated))).toEqual(migrated);
    expect(() =>
      parseProject(
        JSON.stringify({ ...project, layout: { ...project.layout, schemaVersion: 10 } }),
      ),
    ).toThrow('Version 10');
  });
  it('validates independent header and intro gaps and retains them with or without lines', () => {
    const project = createProject('student');
    for (const sectionDividers of [false, true])
      for (const [headerContentGapMm, introBodyGapMm] of [
        [0, 30],
        [30, 0],
        [12.5, 7.5],
      ]) {
        Object.assign(project.layout.appearance, {
          sectionDividers,
          headerContentGapMm,
          introBodyGapMm,
        });
        expect(parseProject(JSON.stringify(project))).toEqual(project);
      }
    for (const settings of [
      { headerContentGapMm: -1 },
      { headerContentGapMm: 31 },
      { headerContentGapMm: '5mm' },
      { introBodyGapMm: -1 },
      { introBodyGapMm: 30.1 },
      { introBodyGapMm: null },
    ]) {
      expect(
        layoutSchema.safeParse({
          ...project.layout,
          appearance: { ...project.layout.appearance, ...settings },
        }).success,
      ).toBe(false);
    }
  });
  it('migrates v9 divider settings with the stored section spacing and automatic length', () => {
    const project = createProject('adult');
    Object.assign(project.layout.appearance, {
      sectionDividers: true,
      spacingMm: 7,
      timelineOffsetMm: -8,
    });
    const {
      dividerSpacingBeforeMm,
      dividerSpacingAfterMm,
      dividerLengthPercent,
      headerContentGapMm,
      introBodyGapMm,
      sectionHeadings,
      showContactHeading,
      showRunningHeader,
      showFooter,
      introDividerSpacingBeforeMm,
      introDividerSpacingAfterMm,
      contactOrder,
      contactLineHeight,
      contactSpacingMm,
      stationDateLineHeight,
      stationTitleLineHeight,
      stationOrganizationLineHeight,
      stationDateTitleGapMm,
      stationTitleOrganizationGapMm,
      ...appearance
    } = project.layout.appearance;
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 9, appearance },
    });
    const migrated = parseProject(JSON.stringify(legacy));
    expect(migrated).toEqual({
      ...project,
      layout: {
        ...project.layout,
        appearance: {
          ...project.layout.appearance,
          dividerSpacingBeforeMm: 7,
          dividerSpacingAfterMm: 7,
          introBodyGapMm: 7,
          introDividerSpacingBeforeMm: 7,
          introDividerSpacingAfterMm: 7,
        },
      },
    });
    expect(parseProject(JSON.stringify(migrated))).toEqual(migrated);
    expect(() =>
      parseProject(JSON.stringify({ ...project, layout: { ...project.layout, schemaVersion: 9 } })),
    ).toThrow('Version 9');
  });
  it('retains bounded independent divider spacing and optional lengths', () => {
    const project = createProject('student');
    for (const dividerLengthPercent of [null, 10, 65, 100]) {
      Object.assign(project.layout.appearance, {
        dividerSpacingBeforeMm: 0,
        dividerSpacingAfterMm: 15,
        dividerLengthPercent,
      });
      expect(parseProject(JSON.stringify(project))).toEqual(project);
    }
    for (const settings of [
      { dividerSpacingBeforeMm: -1 },
      { dividerSpacingBeforeMm: 15.1 },
      { dividerSpacingAfterMm: -1 },
      { dividerSpacingAfterMm: 16 },
      { dividerSpacingAfterMm: '5mm' },
      { dividerLengthPercent: 0 },
      { dividerLengthPercent: 101 },
      { dividerLengthPercent: '50%' },
    ]) {
      expect(
        layoutSchema.safeParse({
          ...project.layout,
          appearance: { ...project.layout.appearance, ...settings },
        }).success,
      ).toBe(false);
    }
  });
  it('migrates v8 layouts with dividers disabled and round-trips the optional setting', () => {
    const project = createProject('adult');
    const {
      sectionDividers,
      dividerSpacingBeforeMm,
      dividerSpacingAfterMm,
      dividerLengthPercent,
      headerContentGapMm,
      introBodyGapMm,
      sectionHeadings,
      showContactHeading,
      showRunningHeader,
      showFooter,
      introDividerSpacingBeforeMm,
      introDividerSpacingAfterMm,
      contactOrder,
      contactLineHeight,
      contactSpacingMm,
      stationDateLineHeight,
      stationTitleLineHeight,
      stationOrganizationLineHeight,
      stationDateTitleGapMm,
      stationTitleOrganizationGapMm,
      ...appearance
    } = project.layout.appearance;
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 8, appearance },
    });
    expect(parseProject(JSON.stringify(legacy))).toEqual(project);
    expect(() =>
      parseProject(JSON.stringify({ ...project, layout: { ...project.layout, schemaVersion: 8 } })),
    ).toThrow('Version 8');
    project.layout.appearance.sectionDividers = true;
    expect(parseProject(JSON.stringify(project))).toEqual(project);
    expect(
      layoutSchema.safeParse({
        ...project.layout,
        appearance: { ...project.layout.appearance, sectionDividers: 'true' },
      }).success,
    ).toBe(false);
  });
  it('migrates v7 layouts with the previous text gap and standard station spacing', () => {
    const project = createProject('adult');
    project.layout.appearance.timelineOffsetMm = -8;
    const {
      timelineTextGapMm,
      stationSpacingMm,
      sectionDividers,
      dividerSpacingBeforeMm,
      dividerSpacingAfterMm,
      dividerLengthPercent,
      headerContentGapMm,
      introBodyGapMm,
      sectionHeadings,
      showContactHeading,
      showRunningHeader,
      showFooter,
      introDividerSpacingBeforeMm,
      introDividerSpacingAfterMm,
      contactOrder,
      contactLineHeight,
      contactSpacingMm,
      stationDateLineHeight,
      stationTitleLineHeight,
      stationOrganizationLineHeight,
      stationDateTitleGapMm,
      stationTitleOrganizationGapMm,
      ...appearance
    } = project.layout.appearance;
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 7, appearance },
    });
    expect(parseProject(JSON.stringify(legacy))).toEqual(project);
    expect(legacy.layout.appearance).not.toHaveProperty('timelineTextGapMm');
    expect(() =>
      parseProject(JSON.stringify({ ...project, layout: { ...project.layout, schemaVersion: 7 } })),
    ).toThrow('Version 7');
  });
  it('retains bounded timeline and station spacing for every marker style', () => {
    for (const timelineStyle of ['none', 'dots', 'line'] as const) {
      for (const timelineTextGapMm of [2, 3.75, 14]) {
        for (const stationSpacingMm of [0, 1.5, 12]) {
          const project = createProject('student');
          Object.assign(project.layout.appearance, {
            timelineStyle,
            timelineTextGapMm,
            stationSpacingMm,
          });
          expect(parseProject(JSON.stringify(project))).toEqual(project);
        }
      }
    }
    const project = createProject('student');
    for (const setting of [
      { timelineTextGapMm: 1.9 },
      { timelineTextGapMm: 14.1 },
      { timelineTextGapMm: '5mm' },
      { stationSpacingMm: -1 },
      { stationSpacingMm: 12.1 },
    ]) {
      expect(
        layoutSchema.safeParse({
          ...project.layout,
          appearance: { ...project.layout.appearance, ...setting },
        }).success,
      ).toBe(false);
    }
  });
  it('migrates v6 layouts with fully visible header images and validates transparency', () => {
    const project = createProject('adult');
    project.layout.appearance.headerEdgeMirrored = true;
    const {
      headerImageTransparencyPercent,
      timelineTextGapMm,
      stationSpacingMm,
      sectionDividers,
      dividerSpacingBeforeMm,
      dividerSpacingAfterMm,
      dividerLengthPercent,
      headerContentGapMm,
      introBodyGapMm,
      sectionHeadings,
      showContactHeading,
      showRunningHeader,
      showFooter,
      introDividerSpacingBeforeMm,
      introDividerSpacingAfterMm,
      contactOrder,
      contactLineHeight,
      contactSpacingMm,
      stationDateLineHeight,
      stationTitleLineHeight,
      stationOrganizationLineHeight,
      stationDateTitleGapMm,
      stationTitleOrganizationGapMm,
      ...appearance
    } = project.layout.appearance;
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 6, appearance },
    });
    expect(parseProject(JSON.stringify(legacy))).toEqual(project);
    expect(legacy.layout.appearance).not.toHaveProperty('headerImageTransparencyPercent');
    expect(() =>
      parseProject(JSON.stringify({ ...project, layout: { ...project.layout, schemaVersion: 6 } })),
    ).toThrow('Version 6');
    for (const headerImageTransparencyPercent of [0, 50, 100]) {
      project.layout.appearance.headerImageTransparencyPercent = headerImageTransparencyPercent;
      expect(parseProject(JSON.stringify(project))).toEqual(project);
    }
    for (const headerImageTransparencyPercent of [-1, 101, '50%', null, undefined]) {
      expect(
        layoutSchema.safeParse({
          ...project.layout,
          appearance: { ...project.layout.appearance, headerImageTransparencyPercent },
        }).success,
      ).toBe(false);
    }
  });
  it('migrates v5 layouts without mirroring and round-trips the explicit mirror setting', () => {
    const project = createProject('adult');
    project.layout.appearance.headerEdge = 'diagonal';
    const {
      headerEdgeMirrored,
      headerImageTransparencyPercent,
      timelineTextGapMm,
      stationSpacingMm,
      sectionDividers,
      dividerSpacingBeforeMm,
      dividerSpacingAfterMm,
      dividerLengthPercent,
      headerContentGapMm,
      introBodyGapMm,
      sectionHeadings,
      showContactHeading,
      showRunningHeader,
      showFooter,
      introDividerSpacingBeforeMm,
      introDividerSpacingAfterMm,
      contactOrder,
      contactLineHeight,
      contactSpacingMm,
      stationDateLineHeight,
      stationTitleLineHeight,
      stationOrganizationLineHeight,
      stationDateTitleGapMm,
      stationTitleOrganizationGapMm,
      ...appearance
    } = project.layout.appearance;
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 5, appearance },
    });
    expect(parseProject(JSON.stringify(legacy))).toEqual(project);
    expect(legacy.layout.appearance).not.toHaveProperty('headerEdgeMirrored');
    project.layout.appearance.headerEdgeMirrored = true;
    expect(parseProject(JSON.stringify(project))).toEqual(project);
    expect(() =>
      parseProject(JSON.stringify({ ...project, layout: { ...project.layout, schemaVersion: 5 } })),
    ).toThrow('Version 5');
    expect(
      layoutSchema.safeParse({
        ...project.layout,
        appearance: { ...project.layout.appearance, headerEdgeMirrored: 'yes' },
      }).success,
    ).toBe(false);
  });
  it('migrates v4 photo settings without changing existing geometry, assets or content', () => {
    const project = createProject('adult');
    Object.assign(project.layout.appearance, { photoSide: 'left', photoOverlapMm: 12 });
    const {
      photoWidthMm,
      photoBorderWidthMm,
      photoBorderColor,
      photoFit,
      photoPositionX,
      photoPositionY,
      headerEdgeMirrored,
      headerImageTransparencyPercent,
      timelineTextGapMm,
      stationSpacingMm,
      sectionDividers,
      dividerSpacingBeforeMm,
      dividerSpacingAfterMm,
      dividerLengthPercent,
      headerContentGapMm,
      introBodyGapMm,
      sectionHeadings,
      showContactHeading,
      showRunningHeader,
      showFooter,
      introDividerSpacingBeforeMm,
      introDividerSpacingAfterMm,
      contactOrder,
      contactLineHeight,
      contactSpacingMm,
      stationDateLineHeight,
      stationTitleLineHeight,
      stationOrganizationLineHeight,
      stationDateTitleGapMm,
      stationTitleOrganizationGapMm,
      ...appearance
    } = project.layout.appearance;
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 4, appearance },
    });
    const migrated = parseProject(JSON.stringify(legacy));
    expect(migrated).toEqual(project);
    expect(parseProject(JSON.stringify(migrated))).toEqual(project);
    expect(legacy.layout.appearance).not.toHaveProperty('photoWidthMm');
    expect(() =>
      parseProject(JSON.stringify({ ...project, layout: { ...project.layout, schemaVersion: 4 } })),
    ).toThrow('Version 4');
    expect(() =>
      parseProject(
        JSON.stringify({
          ...legacy,
          layout: { ...legacy.layout, appearance: { ...appearance, unrecognized: 'keep me' } },
        }),
      ),
    ).toThrow();
  });
  it('retains photo size, border and crop settings and rejects unsafe values', () => {
    for (const photoWidthMm of [24, 34, 60]) {
      for (const photoBorderWidthMm of [0, 1.2, 4]) {
        const project = createProject('student');
        Object.assign(project.layout.appearance, {
          photoWidthMm,
          photoBorderWidthMm,
          photoBorderColor: '#ffc040',
          photoFit: 'contain',
          photoPositionX: 100,
          photoPositionY: 0,
        });
        expect(parseProject(JSON.stringify(project))).toEqual(project);
      }
    }
    const project = createProject('student');
    for (const setting of [
      { photoWidthMm: 23 },
      { photoWidthMm: 61 },
      { photoWidthMm: '40mm' },
      { photoBorderWidthMm: -1 },
      { photoBorderWidthMm: 4.1 },
      { photoBorderColor: 'url(https://example.com)' },
      { photoFit: 'stretch' },
      { photoPositionX: -1 },
      { photoPositionY: 101 },
    ]) {
      expect(
        layoutSchema.safeParse({
          ...project.layout,
          appearance: { ...project.layout.appearance, ...setting },
        }).success,
      ).toBe(false);
    }
  });
  it('migrates v3 headers with no image, no overlap and the original photo position', () => {
    const project = createProject('adult');
    const {
      photoSide,
      photoOverlapMm,
      headerImageAssetId,
      headerImageDimPercent,
      photoWidthMm,
      photoBorderWidthMm,
      photoBorderColor,
      photoFit,
      photoPositionX,
      photoPositionY,
      headerEdgeMirrored,
      headerImageTransparencyPercent,
      timelineTextGapMm,
      stationSpacingMm,
      sectionDividers,
      dividerSpacingBeforeMm,
      dividerSpacingAfterMm,
      dividerLengthPercent,
      headerContentGapMm,
      introBodyGapMm,
      sectionHeadings,
      showContactHeading,
      showRunningHeader,
      showFooter,
      introDividerSpacingBeforeMm,
      introDividerSpacingAfterMm,
      contactOrder,
      contactLineHeight,
      contactSpacingMm,
      stationDateLineHeight,
      stationTitleLineHeight,
      stationOrganizationLineHeight,
      stationDateTitleGapMm,
      stationTitleOrganizationGapMm,
      ...appearance
    } = project.layout.appearance;
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 3, appearance },
    });
    expect(parseProject(JSON.stringify(legacy))).toEqual(project);
    expect(legacy.layout.appearance).not.toHaveProperty('photoSide');
    expect(() =>
      parseProject(JSON.stringify({ ...project, layout: { ...project.layout, schemaVersion: 3 } })),
    ).toThrow('Version 3');
  });
  it('round-trips embedded header images with independent photo geometry and rejects unsafe settings', () => {
    const project = createProject('student');
    project.assets.background = {
      mediaType: 'image/png',
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=',
    };
    Object.assign(project.layout.appearance, {
      headerImageAssetId: 'background',
      headerImageDimPercent: 45,
      photoSide: 'left',
      photoOverlapMm: 12,
    });
    expect(parseProject(JSON.stringify(project))).toEqual(project);
    for (const setting of [
      { photoSide: 'top' },
      { photoOverlapMm: -1 },
      { photoOverlapMm: 21 },
      { headerImageDimPercent: 81 },
      { headerImageAssetId: 'https://example.com/image.png' },
      { headerImageAssetId: 'missing' },
    ]) {
      expect(
        projectSchema.safeParse({
          ...project,
          layout: { ...project.layout, appearance: { ...project.layout.appearance, ...setting } },
        }).success,
      ).toBe(false);
    }
  });
  it('round-trips synthetic student, adult and empty projects without losing fields', () => {
    for (const kind of ['student', 'adult', 'blank'] as const) {
      const project = createProject(kind);
      expect(parseProject(JSON.stringify(project))).toEqual(project);
    }
  });
  it('rejects unknown fields rather than silently dropping them', () => {
    const project = { ...studentProject, unrecognized: 'preserve me' };
    expect(() => parseProject(JSON.stringify(project))).toThrow();
  });
  it('migrates v1 layouts without changing existing content or appearance', () => {
    const project = createProject('adult');
    const {
      headerEdge,
      headerEdgeDepthMm,
      timelineStyle,
      timelineOffsetMm,
      photoSide,
      photoOverlapMm,
      headerImageAssetId,
      headerImageDimPercent,
      photoWidthMm,
      photoBorderWidthMm,
      photoBorderColor,
      photoFit,
      photoPositionX,
      photoPositionY,
      headerEdgeMirrored,
      headerImageTransparencyPercent,
      timelineTextGapMm,
      stationSpacingMm,
      sectionDividers,
      dividerSpacingBeforeMm,
      dividerSpacingAfterMm,
      dividerLengthPercent,
      headerContentGapMm,
      introBodyGapMm,
      sectionHeadings,
      showContactHeading,
      showRunningHeader,
      showFooter,
      introDividerSpacingBeforeMm,
      introDividerSpacingAfterMm,
      contactOrder,
      contactLineHeight,
      contactSpacingMm,
      stationDateLineHeight,
      stationTitleLineHeight,
      stationOrganizationLineHeight,
      stationDateTitleGapMm,
      stationTitleOrganizationGapMm,
      ...oldAppearance
    } = project.layout.appearance;
    const legacy = withoutNewReferences({
      ...project,
      manifest: { ...project.manifest, rendererVersion: '1.0.0' },
      layout: { ...project.layout, schemaVersion: 1, appearance: oldAppearance },
    });
    const migrated = parseProject(JSON.stringify(legacy));
    expect(migrated.cv).toEqual(project.cv);
    expect(migrated.layout).toEqual({
      ...project.layout,
      appearance: {
        ...oldAppearance,
        headerEdge: 'straight',
        headerEdgeDepthMm: 10,
        timelineStyle: 'none',
        timelineOffsetMm: 0,
        photoSide: 'right',
        photoOverlapMm: 0,
        headerImageAssetId: null,
        headerImageDimPercent: 25,
        photoWidthMm: 34,
        photoBorderWidthMm: 1.2,
        photoBorderColor: '#ffffff',
        photoFit: 'cover',
        photoPositionX: 50,
        photoPositionY: 50,
        headerEdgeMirrored: false,
        headerImageTransparencyPercent: 0,
        timelineTextGapMm: 3.75,
        stationSpacingMm: 1.5,
        sectionDividers: false,
        dividerSpacingBeforeMm: 5,
        dividerSpacingAfterMm: 5,
        dividerLengthPercent: null,
        headerContentGapMm: 15,
        introBodyGapMm: 5,
        sectionHeadings: project.layout.appearance.sectionHeadings,
        showContactHeading: true,
        showRunningHeader: true,
        showFooter: true,
        ...independentSpacingDefaults(project),
      },
    });
    expect(parseProject(JSON.stringify(migrated))).toEqual(migrated);
  });
  it('migrates old CVs with an empty optional marital status and keeps all existing data', () => {
    const project = historicalProject('student');
    const { maritalStatus, birthDate, ...contact } = project.cv.contact;
    const legacy = withoutNewReferences({
      ...project,
      cv: { ...project.cv, ...legacyEntries(project.cv), schemaVersion: 1, contact },
    });
    const migrated = parseProject(JSON.stringify(legacy));
    expect(migrated).toEqual(project);
    expect(migrated.cv.contact.maritalStatus).toBe('');
    expect(legacy.cv).not.toHaveProperty('contact.maritalStatus');
  });
  it('migrates both CV and layout versions independently and rejects conflicting personal fields', () => {
    const project = historicalProject('adult');
    const { maritalStatus, birthDate, ...contact } = project.cv.contact;
    const {
      headerEdge,
      headerEdgeDepthMm,
      timelineStyle,
      timelineOffsetMm,
      photoSide,
      photoOverlapMm,
      headerImageAssetId,
      headerImageDimPercent,
      photoWidthMm,
      photoBorderWidthMm,
      photoBorderColor,
      photoFit,
      photoPositionX,
      photoPositionY,
      headerEdgeMirrored,
      headerImageTransparencyPercent,
      timelineTextGapMm,
      stationSpacingMm,
      sectionDividers,
      dividerSpacingBeforeMm,
      dividerSpacingAfterMm,
      dividerLengthPercent,
      headerContentGapMm,
      introBodyGapMm,
      sectionHeadings,
      showContactHeading,
      showRunningHeader,
      showFooter,
      introDividerSpacingBeforeMm,
      introDividerSpacingAfterMm,
      contactOrder,
      contactLineHeight,
      contactSpacingMm,
      stationDateLineHeight,
      stationTitleLineHeight,
      stationOrganizationLineHeight,
      stationDateTitleGapMm,
      stationTitleOrganizationGapMm,
      ...appearance
    } = project.layout.appearance;
    const legacy = withoutNewReferences({
      ...project,
      cv: { ...project.cv, ...legacyEntries(project.cv), schemaVersion: 1, contact },
      layout: { ...project.layout, schemaVersion: 1, appearance },
    });
    const migrated = parseProject(JSON.stringify(legacy));
    expect(migrated.cv).toEqual(project.cv);
    expect(migrated.layout.appearance.headerEdge).toBe('straight');
    expect(migrated.layout.appearance.timelineStyle).toBe('none');
    expect(() =>
      parseProject(JSON.stringify({ ...project, cv: { ...project.cv, schemaVersion: 1 } })),
    ).toThrow('Version 1');
    expect(() =>
      parseProject(
        JSON.stringify({ ...legacy, cv: { ...legacy.cv, unexpected: 'must not be discarded' } }),
      ),
    ).toThrow();
  });
  it('round-trips an explicitly supplied marital status without restricting personal wording', () => {
    const project = createProject('adult');
    project.cv.contact.maritalStatus = 'Verheiratet';
    expect(parseProject(JSON.stringify(project))).toEqual(project);
  });
  it('rejects unknown versions and conflicting fields during migration', () => {
    const project = createProject('student');
    expect(() =>
      parseProject(
        JSON.stringify({ ...project, layout: { ...project.layout, schemaVersion: 99 } }),
      ),
    ).toThrow();
    expect(() =>
      parseProject(JSON.stringify({ ...project, layout: { ...project.layout, schemaVersion: 1 } })),
    ).toThrow('Version 1');
  });
  it('migrates v2 layouts with the original timeline position and preserves their settings', () => {
    const project = createProject('adult');
    project.layout.appearance.timelineStyle = 'dots';
    project.layout.appearance.headerEdge = 'diagonal';
    const {
      timelineOffsetMm,
      photoSide,
      photoOverlapMm,
      headerImageAssetId,
      headerImageDimPercent,
      photoWidthMm,
      photoBorderWidthMm,
      photoBorderColor,
      photoFit,
      photoPositionX,
      photoPositionY,
      headerEdgeMirrored,
      headerImageTransparencyPercent,
      timelineTextGapMm,
      stationSpacingMm,
      sectionDividers,
      dividerSpacingBeforeMm,
      dividerSpacingAfterMm,
      dividerLengthPercent,
      headerContentGapMm,
      introBodyGapMm,
      sectionHeadings,
      showContactHeading,
      showRunningHeader,
      showFooter,
      introDividerSpacingBeforeMm,
      introDividerSpacingAfterMm,
      contactOrder,
      contactLineHeight,
      contactSpacingMm,
      stationDateLineHeight,
      stationTitleLineHeight,
      stationOrganizationLineHeight,
      stationDateTitleGapMm,
      stationTitleOrganizationGapMm,
      ...appearance
    } = project.layout.appearance;
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 2, appearance },
    });
    const migrated = parseProject(JSON.stringify(legacy));
    expect(migrated).toEqual(project);
    expect(migrated.layout.schemaVersion).toBe(23);
    expect(parseProject(JSON.stringify(migrated))).toEqual(migrated);
    expect(legacy.layout.appearance).not.toHaveProperty('timelineOffsetMm');
    expect(() =>
      parseProject(JSON.stringify({ ...project, layout: { ...project.layout, schemaVersion: 2 } })),
    ).toThrow('Version 2');
    expect(() =>
      parseProject(
        JSON.stringify({
          ...legacy,
          layout: { ...legacy.layout, appearance: { ...appearance, unexpected: 'keep me' } },
        }),
      ),
    ).toThrow();
  });
  it('retains bounded timeline offsets independently of station style', () => {
    for (const timelineStyle of ['line', 'dots', 'none'] as const) {
      for (const timelineOffsetMm of [-10, -8, -4, -0.5, 0, 0.5, 12]) {
        const project = createProject('student');
        Object.assign(project.layout.appearance, { timelineStyle, timelineOffsetMm });
        expect(parseProject(JSON.stringify(project))).toEqual(project);
      }
    }
    for (const timelineOffsetMm of [-10.1, 12.1, '2mm', null, undefined]) {
      const project = createProject('student');
      expect(
        layoutSchema.safeParse({
          ...project.layout,
          appearance: { ...project.layout.appearance, timelineOffsetMm },
        }).success,
      ).toBe(false);
    }
  });
  it('validates header shapes, form depth and station styles and retains them on export', () => {
    const project = createProject('student');
    project.layout.appearance.headerEdge = 'diagonal';
    project.layout.appearance.headerEdgeDepthMm = 16;
    project.layout.appearance.timelineStyle = 'dots';
    expect(parseProject(JSON.stringify(project))).toEqual(project);
    expect(
      layoutSchema.safeParse({
        ...project.layout,
        appearance: { ...project.layout.appearance, headerEdge: 'custom-script' },
      }).success,
    ).toBe(false);
    expect(
      layoutSchema.safeParse({
        ...project.layout,
        appearance: { ...project.layout.appearance, headerEdgeDepthMm: 50 },
      }).success,
    ).toBe(false);
    expect(
      layoutSchema.safeParse({
        ...project.layout,
        appearance: { ...project.layout.appearance, timelineStyle: 'custom' },
      }).success,
    ).toBe(false);
  });
  it('rejects incompatible versions and mismatched template references', () => {
    const project = createProject('student');
    expect(
      projectSchema.safeParse({ ...project, manifest: { ...project.manifest, formatVersion: 2 } })
        .success,
    ).toBe(false);
    project.layout.templateId = 'missing';
    expect(projectSchema.safeParse(project).success).toBe(false);
  });
  it('requires each section once and preserves explicit ordering and placement', () => {
    const layout = structuredClone(studentProject.layout);
    layout.sections.reverse();
    layout.sections[0].region = 'main';
    expect(layoutSchema.parse(layout).sections).toEqual(layout.sections);
    layout.sections[0] = layout.sections[1];
    expect(layoutSchema.safeParse(layout).success).toBe(false);
  });
  it('restricts geometry, fonts and colours to safe renderer values', () => {
    const layout = studentProject.layout;
    expect(
      layoutSchema.safeParse({ ...layout, page: { ...layout.page, marginMm: -10 } }).success,
    ).toBe(false);
    expect(
      layoutSchema.safeParse({
        ...layout,
        appearance: { ...layout.appearance, fontId: 'https://remote/font' },
      }).success,
    ).toBe(false);
    expect(
      layoutSchema.safeParse({
        ...layout,
        appearance: { ...layout.appearance, accent: 'url(javascript:alert(1))' },
      }).success,
    ).toBe(false);
  });
  it('rejects scripts, remote photos and dangling photo references', () => {
    const project = createProject('student');
    expect(
      projectSchema.safeParse({
        ...project,
        assets: { photo: { mediaType: 'image/png', data: 'https://remote/photo.png' } },
      }).success,
    ).toBe(false);
    project.cv.contact.photoAssetId = 'missing';
    expect(projectSchema.safeParse(project).success).toBe(false);
  });
  it('rejects duplicate entry IDs which would make pagination ambiguous', () => {
    const project = createProject('student');
    project.cv.education.push(structuredClone(project.cv.education[0]));
    expect(projectSchema.safeParse(project).success).toBe(false);
  });
  it('rejects impossible dates and inverted periods', () => {
    expect(dateSchema.safeParse({ year: 2025, month: 13 }).success).toBe(false);
    const project = createProject('student');
    project.cv.education[0].end = { year: 2020 };
    expect(projectSchema.safeParse(project).success).toBe(false);
  });
  it('rejects oversized, malformed or executable imports', () => {
    expect(() => parseProject('x'.repeat(6 * 1024 * 1024 + 1))).toThrow('zu gross');
    expect(() => parseProject('<script>alert(1)</script>')).toThrow('JSON');
  });
});
