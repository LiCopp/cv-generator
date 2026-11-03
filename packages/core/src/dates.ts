import { z } from 'zod';
import { type Entry } from './schemas/cv';

export const datePrecisions = ['day', 'month', 'year'] as const;

export type DatePrecision = (typeof datePrecisions)[number];

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export const dateSchema = z
  .strictObject({
    year: z.number().int().min(1900).max(2200),
    month: z.number().int().min(1).max(12).optional(),
    day: z.number().int().min(1).max(31).optional(),
  })
  .refine(
    (value) =>
      value.day === undefined ||
      (value.month !== undefined && value.day <= daysInMonth(value.year, value.month)),
    { message: 'Bitte gib ein gültiges Kalenderdatum ein.', path: ['day'] },
  );

export const birthDateSchema = dateSchema.refine(
  (value) => value.month !== undefined && value.day !== undefined,
  'Bitte gib ein vollständiges Geburtsdatum ein.',
);

export function dateBound(
  value: z.infer<typeof dateSchema>,
  precision: DatePrecision,
  latest: boolean,
): number {
  const month = precision === 'year' ? undefined : value.month;
  const effectiveMonth = month ?? (latest ? 12 : 1);
  const day = precision === 'day' && month ? value.day : undefined;
  return Date.UTC(
    value.year,
    effectiveMonth - 1,
    day ?? (latest ? daysInMonth(value.year, effectiveMonth) : 1),
  );
}

export type CvDate = z.infer<typeof dateSchema>;

/** Infer only stored precision; never manufacture a month or day for an incomplete date. */
export function datePrecision(value: CvDate | null): DatePrecision {
  return !value || value.day !== undefined ? 'day' : value.month !== undefined ? 'month' : 'year';
}

export function dateInput(
  value: CvDate | null,
  precision: DatePrecision = datePrecision(value),
): string {
  if (!value) return '';
  if (precision === 'year') return String(value.year);
  if (value.month === undefined) return '';
  const month = `${value.year}-${String(value.month).padStart(2, '0')}`;
  return precision === 'month'
    ? month
    : value.day === undefined
      ? ''
      : `${month}-${String(value.day).padStart(2, '0')}`;
}

export function parseDateInput(value: string, precision: DatePrecision = 'day'): CvDate | null {
  if (!value) return null;
  const pattern =
    precision === 'day'
      ? /^\d{4}-\d{2}-\d{2}$/
      : precision === 'month'
        ? /^\d{4}-\d{2}$/
        : /^\d{4}$/;
  if (!pattern.test(value)) throw new Error('Bitte gib ein vollständiges Datum ein.');
  const [year, month, day] = value.split('-').map(Number);
  return dateSchema.parse({
    year,
    ...(month !== undefined ? { month } : {}),
    ...(day !== undefined ? { day } : {}),
  });
}

export function formatDate(
  value: CvDate | null,
  precision: DatePrecision = datePrecision(value),
): string {
  if (!value) return '';
  if (precision === 'year' || value.month === undefined) return String(value.year);
  const month = String(value.month).padStart(2, '0');
  return precision === 'month' || value.day === undefined
    ? `${month}/${value.year}`
    : `${String(value.day).padStart(2, '0')}.${month}.${value.year}`;
}

export function entryPeriod(entry: Entry): string {
  return [
    formatDate(entry.start, entry.startPrecision),
    entry.current ? 'Heute' : formatDate(entry.end, entry.endPrecision),
  ]
    .filter(Boolean)
    .join(' – ');
}
