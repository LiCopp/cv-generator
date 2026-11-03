import { describe, expect, it } from 'vitest';
import { createProject, makeReference } from './fixtures';
import { withoutNewReferences } from './legacy-test-fixtures';
import { parseProject, projectSchema } from './schema';

describe('references and independent resource upgrades', () => {
  it('adds empty references and sidebar placement to old projects without changing existing content and custom design', () => {
    const project = createProject('adult');
    project.layout.sections.reverse();
    project.layout.appearance.sectionHeadings.experience = {
      title: 'Berufserfahrung',
      fontSizePt: 14,
    };
    const legacy = withoutNewReferences({
      ...project,
      cv: { ...project.cv, schemaVersion: 5 },
      layout: { ...project.layout, schemaVersion: 15 },
      template: { ...project.template, schemaVersion: 1, version: '1.0.0' },
    });
    const migrated = parseProject(JSON.stringify(legacy));
    expect(migrated.cv).toEqual(project.cv);
    expect(migrated.assets).toEqual(project.assets);
    expect(migrated.template).toEqual(project.template);
    expect(migrated.layout.appearance).toEqual(project.layout.appearance);
    expect(migrated.layout.sections).toEqual([
      ...project.layout.sections.filter((section) => section.id !== 'references'),
      { id: 'references', region: 'sidebar', enabled: true },
    ]);
    expect(parseProject(JSON.stringify(migrated))).toEqual(migrated);
    expect(legacy.cv).not.toHaveProperty('references');
  });
  it('migrates a main-only template without introducing an unsupported sidebar region', () => {
    const project = createProject('student');
    project.template.regions = ['header', 'main', 'footer'];
    project.layout.sections.forEach((section) => {
      section.region = 'main';
    });
    const legacy = withoutNewReferences({
      ...project,
      layout: { ...project.layout, schemaVersion: 15 },
      template: { ...project.template, schemaVersion: 1, version: '1.0.0' },
    });
    expect(
      parseProject(JSON.stringify(legacy)).layout.sections.find(
        (section) => section.id === 'references',
      )!.region,
    ).toBe('main');
  });
  it('round-trips complete and partial contact persons with persistent IDs and independent placement', () => {
    const project = createProject('student');
    project.cv.references = [
      makeReference({
        name: 'Robin Beispiel',
        role: 'Teamleitung',
        organization: 'Beispiel AG',
        email: 'robin@example.com',
        phone: '+41 44 555 00 11',
        address: 'Musterweg 8',
        city: '8000 Zürich',
      }),
      makeReference({ phone: '+41 31 555 00 22' }),
      makeReference(),
    ];
    expect(new Set(project.cv.references.map((person) => person.id)).size).toBe(3);
    for (const region of ['main', 'sidebar'] as const) {
      const section = project.layout.sections.find((section) => section.id === 'references')!;
      section.region = region;
      section.enabled = false;
      project.layout.appearance.sectionHeadings.references = {
        title: 'Kontaktpersonen',
        fontSizePt: 12,
      };
      expect(parseProject(JSON.stringify(project))).toEqual(project);
    }
    project.cv.references[1].id = project.cv.references[0].id;
    expect(projectSchema.safeParse(project).success).toBe(false);
  });
  it('rejects invalid email, excessive lists, unsafe fields and conflicting old-format data', () => {
    const project = createProject('blank');
    for (const person of [
      makeReference({ email: 'ungültig' }),
      { ...makeReference(), name: 'x'.repeat(301) },
      { ...makeReference(), html: '<script />' },
    ]) {
      expect(
        projectSchema.safeParse({ ...project, cv: { ...project.cv, references: [person] } })
          .success,
      ).toBe(false);
    }
    expect(
      projectSchema.safeParse({
        ...project,
        cv: { ...project.cv, references: Array.from({ length: 101 }, () => makeReference()) },
      }).success,
    ).toBe(false);
    expect(() =>
      parseProject(JSON.stringify({ ...project, cv: { ...project.cv, schemaVersion: 5 } })),
    ).toThrow('Version 5');
    expect(() =>
      parseProject(
        JSON.stringify({ ...project, layout: { ...project.layout, schemaVersion: 15 } }),
      ),
    ).toThrow('Version 15');
    expect(() =>
      parseProject(
        JSON.stringify({
          ...project,
          template: { ...project.template, schemaVersion: 1, version: '1.0.0' },
        }),
      ),
    ).toThrow('Version 1');
  });
});
