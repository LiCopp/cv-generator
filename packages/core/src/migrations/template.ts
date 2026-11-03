/** Upgrade the bundled component vocabulary before validating section placements. */
export function migrateTemplateResource(project: Record<string, unknown>): void {
  const template = project.template;
  if (template && typeof template === 'object' && !Array.isArray(template)) {
    const oldTemplate = template as Record<string, unknown>;
    if (
      oldTemplate.schemaVersion === 1 &&
      oldTemplate.version === '1.0.0' &&
      Array.isArray(oldTemplate.components)
    ) {
      if (oldTemplate.components.includes('references'))
        throw new Error('Die Vorlage enthält Komponenten, die nicht zu Version 1 gehören.');
      project.template = {
        ...oldTemplate,
        schemaVersion: 2,
        version: '1.1.0',
        components: [...oldTemplate.components, 'references'],
      };
    }
  }
}
