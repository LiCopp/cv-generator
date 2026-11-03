import { z } from 'zod';
import { birthDateSchema, dateBound, datePrecisions, dateSchema } from '../dates';
import { id, shortText, text } from './primitives';

export const entrySchema = z
  .strictObject({
    id,
    title: shortText,
    organization: shortText,
    location: shortText,
    start: dateSchema.nullable(),
    end: dateSchema.nullable(),
    current: z.boolean(),
    description: z.string().max(40_000),
    startPrecision: z.enum(datePrecisions),
    endPrecision: z.enum(datePrecisions),
  })
  .refine(
    (value) =>
      !value.start ||
      !value.end ||
      value.current ||
      dateBound(value.start, value.startPrecision, false) <=
        dateBound(value.end, value.endPrecision, true),
    { message: 'Das Ende muss nach dem Beginn liegen.', path: ['end'] },
  );

const labelledItemSchema = z.strictObject({ id, name: shortText, level: shortText });

const proficiencyError = 'Bitte gib eine ganze Zahl zwischen 0 und 100 ein.';

const proficiencySchema = z
  .number({ error: proficiencyError })
  .int(proficiencyError)
  .min(0, proficiencyError)
  .max(100, proficiencyError)
  .nullable();

export const languageSchema = labelledItemSchema.extend({ proficiency: proficiencySchema });

export const skillSchema = z.strictObject({
  id,
  name: shortText,
  level: shortText,
  description: text,
  category: shortText,
  proficiency: proficiencySchema,
});

export const referenceSchema = z.strictObject({
  id,
  name: shortText,
  role: shortText,
  organization: shortText,
  email: z
    .string()
    .max(300)
    .refine(
      (value) => !value || z.email().safeParse(value).success,
      'Bitte gib eine gültige E-Mail-Adresse ein.',
    ),
  phone: shortText,
  address: shortText,
  city: shortText,
});

/** Content-only validation; presentation choices belong to layoutSchema. */
export const cvSchema = z
  .strictObject({
    schemaVersion: z.literal(8),
    id,
    title: shortText,
    contact: z.strictObject({
      firstName: shortText,
      lastName: shortText,
      headline: shortText,
      email: z
        .string()
        .max(300)
        .refine(
          (v) => !v || z.email().safeParse(v).success,
          'Bitte gib eine gültige E-Mail-Adresse ein.',
        ),
      phone: shortText,
      address: shortText,
      city: shortText,
      website: shortText,
      maritalStatus: shortText,
      birthDate: birthDateSchema.nullable(),
      photoAssetId: id.nullable(),
    }),
    summary: text,
    experience: z.array(entrySchema).max(100),
    education: z.array(entrySchema).max(100),
    projects: z.array(entrySchema).max(100),
    skills: z.array(skillSchema).max(100),
    languages: z.array(languageSchema).max(100),
    interests: z.array(labelledItemSchema).max(100),
    references: z.array(referenceSchema).max(100),
  })
  .superRefine((cv, ctx) => {
    for (const section of [
      'experience',
      'education',
      'projects',
      'skills',
      'languages',
      'interests',
      'references',
    ] as const) {
      if (new Set(cv[section].map((item) => item.id)).size !== cv[section].length)
        ctx.addIssue({
          code: 'custom',
          path: [section],
          message: 'Einträge müssen eindeutige IDs haben.',
        });
    }
  });

export type Cv = z.infer<typeof cvSchema>;

export type Entry = z.infer<typeof entrySchema>;

export type Skill = z.infer<typeof skillSchema>;

export type Language = z.infer<typeof languageSchema>;

export type Reference = z.infer<typeof referenceSchema>;
