import { createProject } from './fixtures';
import { resetLayoutSettings } from './layout';
import type { Project } from './schema';

export function resetProjectSettings(project: Project, resetData = false): Project {
  return {
    ...project,
    layout: resetLayoutSettings(project.layout, project.template),
    ...(resetData ? { cv: { ...createProject('blank').cv, id: project.cv.id }, assets: {} } : {}),
  };
}
