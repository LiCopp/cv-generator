import { describe, expect, it } from 'vitest';
import { createProject } from './fixtures';
import { withoutNewReferences } from './legacy-test-fixtures';
import { parseProject, projectSchema } from './schema';

describe('header name, physical left column and station order', () => {
  it('round-trips compact typography and rejects values outside the expanded bounds', () => {
    const project = createProject('student');
    for (const lineHeight of [0.9, 1, 1.8])
      for (const leftColumnLineHeight of [null, 0.9, 2.4]) {
        Object.assign(project.layout.appearance, { lineHeight, leftColumnLineHeight });
        expect(parseProject(JSON.stringify(project))).toEqual(project);
      }
    for (const overrides of [
      { lineHeight: 0.85 },
      { lineHeight: 1.85 },
      { lineHeight: '0.9' },
      { leftColumnLineHeight: 0.85 },
      { leftColumnLineHeight: 2.45 },
    ])
      expect(
        projectSchema.safeParse({
          ...project,
          layout: {
            ...project.layout,
            appearance: { ...project.layout.appearance, ...overrides },
          },
        }).success,
      ).toBe(false);
  });

  it('migrates layout v18 with stacked name, inherited column spacing and the original station order', () => {
    const project = createProject('adult');
    Object.assign(project.layout.appearance, {
      headerTextColor: '#204060',
      headerShiftUpMm: 8,
      sidebarSide: 'right',
      lineHeight: 1.8,
    });
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 18 },
    });
    expect(parseProject(JSON.stringify(legacy))).toEqual(project);
    for (const [field, value] of Object.entries({
      headerNameLayout: 'inline',
      leftColumnLineHeight: 1.2,
      stationHeadingOrder: ['title', 'date', 'organization'],
    }))
      expect(() =>
        parseProject(
          JSON.stringify({
            ...legacy,
            layout: {
              ...legacy.layout,
              appearance: { ...legacy.layout.appearance, [field]: value },
            },
          }),
        ),
      ).toThrow('Version 18');
  });
  it('round-trips all six station orders independently of name, column side and line height', () => {
    const project = createProject('student');
    const cv = structuredClone(project.cv);
    const orders = [
      ['date', 'title', 'organization'],
      ['date', 'organization', 'title'],
      ['title', 'date', 'organization'],
      ['title', 'organization', 'date'],
      ['organization', 'date', 'title'],
      ['organization', 'title', 'date'],
    ] as const;
    for (const stationHeadingOrder of orders)
      for (const headerNameLayout of ['stacked', 'inline'])
        for (const leftColumnLineHeight of [null, 0.9, 1, 2.4]) {
          Object.assign(project.layout.appearance, {
            stationHeadingOrder: [...stationHeadingOrder],
            headerNameLayout,
            leftColumnLineHeight,
          });
          expect(parseProject(JSON.stringify(project))).toEqual(project);
          expect(project.cv).toEqual(cv);
        }
  });
  it('rejects missing, duplicate and unknown station fields and unsafe typography options', () => {
    const project = createProject('student');
    for (const appearance of [
      { stationHeadingOrder: ['date', 'title'] },
      { stationHeadingOrder: ['title', 'title', 'date'] },
      { stationHeadingOrder: ['title', 'date', 'html'] },
      { headerNameLayout: 'html' },
      { leftColumnLineHeight: 0.85 },
      { leftColumnLineHeight: 2.5 },
      { leftColumnLineHeight: '2px' },
    ])
      expect(
        projectSchema.safeParse({
          ...project,
          layout: {
            ...project.layout,
            appearance: { ...project.layout.appearance, ...appearance },
          },
        }).success,
      ).toBe(false);
  });
});
