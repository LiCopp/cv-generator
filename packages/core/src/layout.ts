import layoutData from '../../../templates/modern/layouts/default.json' with { type: 'json' };
import { layoutSchema, type Layout, type Project } from './schema';

/** Restore the built-in design without replacing the document or imported template identity. */
export function resetLayoutSettings(layout: Layout, template: Project['template']): Layout {
  const defaults = layoutSchema.parse(layoutData);
  return {
    ...defaults,
    id: layout.id,
    templateId: layout.templateId,
    sections: defaults.sections.map((section) => ({
      ...section,
      region: template.regions.includes(section.region)
        ? section.region
        : layout.sections.find((current) => current.id === section.id)!.region,
    })),
  };
}
