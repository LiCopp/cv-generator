import { describe, expect, it } from 'vitest';
import { createProject } from './fixtures';
import { withoutNewReferences } from './legacy-test-fixtures';
import { parseProject, projectSchema } from './schema';

describe('independent profile photo offset', () => {
  it('migrates layout 20 without moving the photo or changing existing header and overlap settings', () => {
    const project = createProject('adult');
    Object.assign(project.layout.appearance, {
      photoSide: 'left',
      photoOverlapMm: 12,
      headerShiftUpMm: 8,
      headerTextOffsetMm: -3,
      photoPositionY: 65,
      photoWidthMm: 50,
    });
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 20 },
    });
    expect(parseProject(JSON.stringify(legacy))).toEqual(project);
    expect(() =>
      parseProject(
        JSON.stringify({
          ...legacy,
          layout: {
            ...legacy.layout,
            appearance: { ...legacy.layout.appearance, photoOffsetMm: 0 },
          },
        }),
      ),
    ).toThrow('Version 20');
  });
  it('round-trips both directions independently of overlap, crop, photo side and CV data', () => {
    const project = createProject('student'),
      cv = structuredClone(project.cv);
    for (const photoOffsetMm of [-15, -0.5, 0, 0.5, 15])
      for (const photoOverlapMm of [0, 12, 20])
        for (const photoSide of ['left', 'right']) {
          Object.assign(project.layout.appearance, {
            photoOffsetMm,
            photoOverlapMm,
            photoSide,
            photoPositionY: 70,
          });
          expect(parseProject(JSON.stringify(project))).toEqual(project);
          expect(project.cv).toEqual(cv);
        }
  });
  it('rejects offsets outside the supported range and arbitrary style values', () => {
    const project = createProject('student');
    for (const photoOffsetMm of [-15.1, 15.1, '5mm', null, undefined])
      expect(
        projectSchema.safeParse({
          ...project,
          layout: {
            ...project.layout,
            appearance: { ...project.layout.appearance, photoOffsetMm },
          },
        }).success,
      ).toBe(false);
  });
});
