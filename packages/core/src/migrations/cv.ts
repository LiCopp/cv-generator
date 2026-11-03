import { type DatePrecision } from '../dates';
import { escapeDescription } from '../description';

/** Add missing biographical fields without inferring personal information or date precision. */
export function migrateCvResource(project: Record<string, unknown>): void {
  const cv = project.cv;
  if (cv && typeof cv === 'object' && !Array.isArray(cv)) {
    let upgradedCv = cv as Record<string, unknown>;
    const contact = upgradedCv.contact;
    if (
      upgradedCv.schemaVersion === 1 &&
      contact &&
      typeof contact === 'object' &&
      !Array.isArray(contact)
    ) {
      if ('maritalStatus' in contact)
        throw new Error('Der Lebenslauf enthält Felder, die nicht zu Version 1 gehören.');
      upgradedCv = { ...upgradedCv, schemaVersion: 2, contact: { ...contact, maritalStatus: '' } };
    }
    if (upgradedCv.schemaVersion === 2) {
      const migratedCv = { ...upgradedCv, schemaVersion: 3 };
      for (const section of ['education', 'experience', 'projects'] as const) {
        const entries = upgradedCv[section];
        if (!Array.isArray(entries)) continue;
        Object.assign(migratedCv, {
          [section]: entries.map((entry) => {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
            if ('startPrecision' in entry || 'endPrecision' in entry)
              throw new Error(
                'Der Lebenslauf enthält Datumsfelder, die nicht zu Version 2 gehören.',
              );
            for (const key of ['start', 'end']) {
              if (entry[key] && typeof entry[key] === 'object' && 'day' in entry[key])
                throw new Error('Tagesangaben werden erst ab Lebenslauf-Version 3 unterstützt.');
            }
            const precision = (value: unknown): DatePrecision =>
              value && typeof value === 'object' ? ('month' in value ? 'month' : 'year') : 'day';
            return {
              ...entry,
              startPrecision: precision(entry.start),
              endPrecision: precision(entry.end),
            };
          }),
        });
      }
      upgradedCv = migratedCv;
    }
    if (
      upgradedCv.schemaVersion === 3 &&
      upgradedCv.contact &&
      typeof upgradedCv.contact === 'object' &&
      !Array.isArray(upgradedCv.contact)
    ) {
      if ('birthDate' in upgradedCv.contact)
        throw new Error('Der Lebenslauf enthält Felder, die nicht zu Version 3 gehören.');
      upgradedCv = {
        ...upgradedCv,
        schemaVersion: 4,
        contact: { ...upgradedCv.contact, birthDate: null },
      };
    }
    if (upgradedCv.schemaVersion === 4) {
      const migratedCv = { ...upgradedCv, schemaVersion: 5 };
      for (const section of ['education', 'experience', 'projects'] as const) {
        const entries = upgradedCv[section];
        if (!Array.isArray(entries)) continue;
        Object.assign(migratedCv, {
          [section]: entries.map((entry) => {
            if (
              !entry ||
              typeof entry !== 'object' ||
              Array.isArray(entry) ||
              typeof entry.description !== 'string'
            )
              return entry;
            return { ...entry, description: escapeDescription(entry.description) };
          }),
        });
      }
      upgradedCv = migratedCv;
    }
    if (upgradedCv.schemaVersion === 5) {
      if ('references' in upgradedCv)
        throw new Error('Der Lebenslauf enthält Felder, die nicht zu Version 5 gehören.');
      upgradedCv = { ...upgradedCv, schemaVersion: 6, references: [] };
    }
    if (upgradedCv.schemaVersion === 6 && Array.isArray(upgradedCv.skills)) {
      upgradedCv = {
        ...upgradedCv,
        schemaVersion: 7,
        skills: upgradedCv.skills.map((skill) => {
          if (!skill || typeof skill !== 'object' || Array.isArray(skill)) return skill;
          if ('description' in skill || 'category' in skill)
            throw new Error(
              'Der Lebenslauf enthält Kenntnisfelder, die nicht zu Version 6 gehören.',
            );
          return { ...skill, description: '', category: '' };
        }),
      };
    }
    if (upgradedCv.schemaVersion === 7) {
      const migratedCv = { ...upgradedCv, schemaVersion: 8 };
      for (const section of ['skills', 'languages'] as const) {
        const items = upgradedCv[section];
        if (!Array.isArray(items)) continue;
        Object.assign(migratedCv, {
          [section]: items.map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
            if ('proficiency' in item)
              throw new Error(
                'Der Lebenslauf enthält Kompetenzwerte, die nicht zu Version 7 gehören.',
              );
            return { ...item, proficiency: null };
          }),
        });
      }
      upgradedCv = migratedCv;
    }
    project.cv = upgradedCv;
  }
}
