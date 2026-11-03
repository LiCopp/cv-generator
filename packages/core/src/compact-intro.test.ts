import { describe, expect, it } from 'vitest';
import { createProject } from './fixtures';
import { withoutNewReferences } from './legacy-test-fixtures';
import { parseProject, projectSchema } from './schema';

describe('optional compact flow without summary', () => {
  it('migrates layout 21 with the shared introduction preserved and rejects conflicting fields', () => {
    const project = createProject('adult');
    project.layout.sections.find((section) => section.id === 'summary')!.enabled = false;
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 21 },
    });
    expect(parseProject(JSON.stringify(legacy))).toEqual(project);
    expect(() =>
      parseProject(
        JSON.stringify({
          ...legacy,
          layout: {
            ...legacy.layout,
            appearance: { ...legacy.layout.appearance, compactWithoutSummary: true },
          },
        }),
      ),
    ).toThrow('Version 21');
  });

  it('round-trips either choice without modifying content, placement or spacing', () => {
    const project = createProject('student');
    for (const compactWithoutSummary of [false, true]) {
      project.layout.appearance.compactWithoutSummary = compactWithoutSummary;
      expect(parseProject(JSON.stringify(project))).toEqual(project);
    }
    for (const compactWithoutSummary of [null, undefined, 'true', 1])
      expect(
        projectSchema.safeParse({
          ...project,
          layout: {
            ...project.layout,
            appearance: { ...project.layout.appearance, compactWithoutSummary },
          },
        }).success,
      ).toBe(false);
  });
});
