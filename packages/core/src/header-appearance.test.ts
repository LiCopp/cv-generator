import { describe, expect, it } from 'vitest';
import { createProject } from './fixtures';
import { withoutNewReferences } from './legacy-test-fixtures';
import { parseProject, projectSchema } from './schema';

describe('header position and text color', () => {
  it('migrates v17 without changing content, custom layouts, skills or assets', () => {
    const project = createProject('adult');
    project.layout.skills.display = 'bars';
    project.layout.appearance.photoOverlapMm = 12;
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 17 },
    });
    expect(parseProject(JSON.stringify(legacy))).toEqual(project);
    for (const [field, value] of Object.entries({ headerShiftUpMm: 1, headerTextColor: '#123456' }))
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
      ).toThrow('Version 17');
  });
  it('round-trips safe colors and physical offsets and rejects arbitrary style values', () => {
    const project = createProject('student');
    for (const headerShiftUpMm of [0, 0.5, 8, 10, 20])
      for (const headerTextOffsetMm of [-15, -0.5, 0, 0.5, 15])
        for (const headerTextColor of ['#ffffff', '#123456', '#Fa00bC']) {
          Object.assign(project.layout.appearance, {
            headerShiftUpMm,
            headerTextOffsetMm,
            headerTextColor,
          });
          expect(parseProject(JSON.stringify(project))).toEqual(project);
        }
    for (const settings of [
      { headerShiftUpMm: -1 },
      { headerShiftUpMm: 20.1 },
      { headerShiftUpMm: '5mm' },
      { headerTextOffsetMm: -15.1 },
      { headerTextOffsetMm: 15.1 },
      { headerTextOffsetMm: '5mm' },
      { headerTextOffsetMm: null },
      { headerTextColor: 'white' },
      { headerTextColor: 'url(javascript:test)' },
      { headerTextColor: '#fff' },
    ])
      expect(
        projectSchema.safeParse({
          ...project,
          layout: { ...project.layout, appearance: { ...project.layout.appearance, ...settings } },
        }).success,
      ).toBe(false);
  });
  it('migrates v19 with a neutral text position and retains existing header and layout settings', () => {
    const project = createProject('adult');
    Object.assign(project.layout.appearance, {
      headerShiftUpMm: 8,
      headerNameLayout: 'inline',
      headerTextColor: '#123456',
      photoOverlapMm: 15,
      leftColumnLineHeight: 1.8,
    });
    project.layout.skills.display = 'detailed';
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 19 },
    });
    expect(parseProject(JSON.stringify(legacy))).toEqual(project);
    expect(() =>
      parseProject(
        JSON.stringify({
          ...legacy,
          layout: {
            ...legacy.layout,
            appearance: { ...legacy.layout.appearance, headerTextOffsetMm: 0 },
          },
        }),
      ),
    ).toThrow('Version 19');
  });
});
