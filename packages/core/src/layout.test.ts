import { expect, it } from 'vitest';
import layoutData from '../../../templates/modern/layouts/default.json' with { type: 'json' };
import { createProject } from './fixtures';
import { resetLayoutSettings } from './layout';
import { parseProject, projectSchema } from './schema';

it('restores all design defaults while preserving content, assets and layout identity', () => {
  const project = createProject('adult');
  project.layout.id = 'custom-layout';
  project.layout.appearance.accent = '#123456';
  project.layout.appearance.sectionHeadings.experience.title = 'Berufserfahrung';
  project.layout.skills.display = 'bars';
  project.layout.sections.reverse();
  const original = structuredClone(project);
  const layout = resetLayoutSettings(project.layout, project.template);
  expect(layout).toEqual({ ...layoutData, id: 'custom-layout' });
  expect(project).toEqual(original);
  expect(parseProject(JSON.stringify({ ...project, layout }))).toEqual({ ...original, layout });
  layout.appearance.sectionHeadings.experience.title = 'Changed result';
  layout.sections.reverse();
  expect(resetLayoutSettings(project.layout, project.template)).toEqual({
    ...layoutData,
    id: 'custom-layout',
  });
});

it('retains imported template identity and valid placements for templates without a sidebar', () => {
  const project = createProject('student');
  project.template.id = 'imported-template';
  project.layout.templateId = 'imported-template';
  project.template.regions = ['header', 'main', 'footer'];
  project.layout.sections.forEach((section) => {
    section.region = 'main';
  });
  const layout = resetLayoutSettings(project.layout, project.template);
  expect(layout.templateId).toBe('imported-template');
  expect(layout.sections.every((section) => section.region === 'main')).toBe(true);
  expect(projectSchema.safeParse({ ...project, layout }).success).toBe(true);
});
