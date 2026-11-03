import { expect, it } from 'vitest';
import { createProject, makeReference } from './fixtures';
import { resetProjectSettings } from './project-reset';
import { parseProject } from './schema';

it('resets only the design by default and leaves all project content intact', () => {
  const project = createProject('adult');
  project.layout.appearance.accent = '#123456';
  const original = structuredClone(project);
  const reset = resetProjectSettings(project);
  expect(reset.cv).toEqual(original.cv);
  expect(reset.assets).toEqual(original.assets);
  expect(reset.template).toEqual(original.template);
  expect(reset.manifest).toEqual(original.manifest);
  expect(reset.layout.appearance.accent).toBe('#244d43');
  expect(project).toEqual(original);
});

it('explicit data reset removes all personal data and images and remains a valid editable project', () => {
  const project = createProject('adult');
  project.cv.references = [
    makeReference({ name: 'Test Reference', email: 'reference@example.com' }),
  ];
  project.cv.contact.birthDate = { year: 1990, month: 1, day: 2 };
  project.cv.contact.photoAssetId = 'image';
  project.layout.appearance.headerImageAssetId = 'image';
  project.assets.image = {
    mediaType: 'image/png',
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=',
  };
  const original = structuredClone(project);
  const reset = resetProjectSettings(project, true);
  expect(reset.cv).toEqual({ ...createProject('blank').cv, id: project.cv.id });
  expect(reset.assets).toEqual({});
  expect(reset.layout.appearance.headerImageAssetId).toBeNull();
  expect(reset.template).toEqual(project.template);
  expect(reset.manifest).toEqual(project.manifest);
  expect(parseProject(JSON.stringify(reset))).toEqual(reset);
  expect(project).toEqual(original);
});
