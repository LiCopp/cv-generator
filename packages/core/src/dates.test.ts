import { withoutNewReferences } from './legacy-test-fixtures';
import { describe, expect, it } from 'vitest';
import { createProject, makeEntry } from './fixtures';
import {
  dateInput,
  dateSchema,
  entryPeriod,
  entrySchema,
  formatDate,
  parseDateInput,
  parseProject,
} from './schema';

describe('station dates and precision', () => {
  it('defaults both endpoints of new entries to days while leaving dates empty', () => {
    const entry = makeEntry();
    expect(entry.startPrecision).toBe('day');
    expect(entry.endPrecision).toBe('day');
    expect(entry.start).toBeNull();
    expect(entry.end).toBeNull();
  });
  it('validates actual calendar days, including Gregorian leap-year rules', () => {
    expect(dateSchema.safeParse({ year: 2024, month: 2, day: 29 }).success).toBe(true);
    expect(dateSchema.safeParse({ year: 2000, month: 2, day: 29 }).success).toBe(true);
    for (const date of [
      { year: 2025, month: 2, day: 29 },
      { year: 1900, month: 2, day: 29 },
      { year: 2100, month: 2, day: 29 },
      { year: 2025, month: 4, day: 31 },
      { year: 2025, day: 1 },
      { year: 2025, month: 3, day: 0 },
    ])
      expect(dateSchema.safeParse(date).success).toBe(false);
  });
  it('converts native day and month inputs without adding missing components', () => {
    expect(parseDateInput('2025-03-15')).toEqual({ year: 2025, month: 3, day: 15 });
    expect(parseDateInput('2025-03', 'month')).toEqual({ year: 2025, month: 3 });
    expect(parseDateInput('2025', 'year')).toEqual({ year: 2025 });
    expect(parseDateInput('')).toBeNull();
    expect(() => parseDateInput('2025-02-29')).toThrow();
    expect(() => parseDateInput('2025-03')).toThrow();
    expect(dateInput({ year: 2025 }, 'month')).toBe('');
    expect(dateInput({ year: 2025, month: 3 }, 'day')).toBe('');
    expect(dateInput({ year: 2025, month: 3, day: 15 }, 'day')).toBe('2025-03-15');
  });
  it('formats each endpoint independently and retains a hidden day for switching back', () => {
    const start = { year: 2025, month: 3, day: 15 };
    const entry = makeEntry({ start, end: { year: 2025, month: 4, day: 30 } });
    expect(entryPeriod(entry)).toBe('15.03.2025 – 30.04.2025');
    entry.startPrecision = 'month';
    expect(entryPeriod(entry)).toBe('03/2025 – 30.04.2025');
    expect(entry.start).toEqual(start);
    entry.startPrecision = 'day';
    expect(entryPeriod(entry)).toBe('15.03.2025 – 30.04.2025');
    entry.current = true;
    expect(entryPeriod(entry)).toBe('15.03.2025 – Heute');
    expect(formatDate({ year: 2025, month: 3 }, 'day')).toBe('03/2025');
    expect(formatDate({ year: 2025 }, 'day')).toBe('2025');
  });
  it('accepts a single-day station without an end date or an ongoing marker', () => {
    const entry = makeEntry({
      title: 'Schnuppertag',
      start: { year: 2026, month: 10, day: 12 },
      end: null,
      current: false,
    });
    expect(entrySchema.parse(entry)).toEqual(entry);
    expect(entryPeriod(entry)).toBe('12.10.2026');
    const project = createProject('blank');
    for (const section of ['education', 'experience', 'projects'] as const)
      project.cv[section] = [{ ...entry, id: `${section}-day` }];
    expect(parseProject(JSON.stringify(project))).toEqual(project);
    expect(entryPeriod({ ...entry, current: true })).toBe('12.10.2026 – Heute');
  });
  it('checks day ordering while allowing overlapping ranges of imprecise dates', () => {
    const entry = makeEntry({
      start: { year: 2025, month: 3, day: 16 },
      end: { year: 2025, month: 3, day: 15 },
    });
    expect(entrySchema.safeParse(entry).success).toBe(false);
    expect(entrySchema.safeParse({ ...entry, endPrecision: 'month' }).success).toBe(true);
    expect(entrySchema.safeParse({ ...entry, end: { year: 2025, month: 2 } }).success).toBe(false);
    expect(entrySchema.safeParse({ ...entry, current: true }).success).toBe(true);
    expect(
      entrySchema.safeParse({ ...entry, start: { year: 2025 }, startPrecision: 'year' }).success,
    ).toBe(true);
  });
  it('round-trips exact dates, both precision preferences and retained days', () => {
    const project = createProject('student');
    project.cv.education[0].startPrecision = 'month';
    expect(parseProject(JSON.stringify(project))).toEqual(project);
  });
  it('migrates old month/year values and empty endpoints without inventing days', () => {
    const project = createProject('blank');
    const entry = makeEntry({ start: { year: 2020 }, end: { year: 2025, month: 3 } });
    const { startPrecision, endPrecision, ...oldEntry } = entry;
    const empty = makeEntry();
    const { startPrecision: ignoredStart, endPrecision: ignoredEnd, ...oldEmpty } = empty;
    const { birthDate, ...contact } = project.cv.contact;
    const old = withoutNewReferences({
      ...project,
      cv: { ...project.cv, contact, schemaVersion: 2, experience: [oldEntry, oldEmpty] },
    });
    const migrated = parseProject(JSON.stringify(old));
    expect(migrated.cv.schemaVersion).toBe(8);
    expect(migrated.cv.experience[0]).toEqual(entry);
    expect(migrated.cv.experience[1]).toEqual(empty);
    expect(entryPeriod(migrated.cv.experience[0])).toBe('2020 – 03/2025');
    expect(old.cv.experience[0]).not.toHaveProperty('startPrecision');
  });
  it('rejects conflicting new date fields in old schema versions', () => {
    const project = createProject('student');
    expect(() =>
      parseProject(JSON.stringify({ ...project, cv: { ...project.cv, schemaVersion: 2 } })),
    ).toThrow('Version 2');
  });
});
