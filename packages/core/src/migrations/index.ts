import { migrateCvResource } from './cv';
import { migrateLayoutResource } from './layout';
import { migrateTemplateResource } from './template';

/**
 * Upgrade independent template, CV and layout versions in their original order.
 * Each resource advances through consecutive steps, never directly to current defaults.
 * Unexpected fields are rejected before a step can overwrite them; malformed shapes
 * pass through to strict Zod validation so imports never silently discard information.
 * The top-level copy and per-step spreads leave the caller's input untouched.
 */
export function migrateProject(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const project = { ...data } as Record<string, unknown>;
  migrateTemplateResource(project);
  migrateCvResource(project);
  return migrateLayoutResource(project);
}
