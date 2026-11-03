import { migrateProject } from './migrations/index';
import { projectSchema, type Project } from './schemas/project';

export const MAX_IMPORT_BYTES = 6 * 1024 * 1024;

/**
 * Import untrusted JSON through size checks, explicit migrations and strict validation.
 * The byte limit applies to UTF-8, not JavaScript string length. Unknown fields and
 * unsupported versions remain errors; callers receive a complete current Project.
 */
export function parseProject(source: string): Project {
  if (new TextEncoder().encode(source).length > MAX_IMPORT_BYTES)
    throw new Error('Die Datei ist zu gross. Erlaubt sind maximal 6 MB.');
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    throw new Error('Die Datei enthält kein gültiges JSON.');
  }
  const result = projectSchema.safeParse(migrateProject(data));
  if (!result.success)
    throw new Error(
      `Das Projekt ist ungültig oder verwendet eine nicht unterstützte Version. ${result.error.issues[0]?.message ?? ''}`,
    );
  return result.data;
}
