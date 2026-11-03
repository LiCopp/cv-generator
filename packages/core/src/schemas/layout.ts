import { z } from 'zod';
import { headerEdges } from '../header-shapes';
import { contactFieldIds, sectionIds, stationHeadingFields } from '../sections';
import { id } from './primitives';

const sectionHeadingSchema = z.strictObject({
  title: z.string().max(120),
  fontSizePt: z.number().min(8).max(20),
});

const sectionHeadingsSchema = z.strictObject({
  contact: sectionHeadingSchema,
  summary: sectionHeadingSchema,
  experience: sectionHeadingSchema,
  education: sectionHeadingSchema,
  projects: sectionHeadingSchema,
  skills: sectionHeadingSchema,
  languages: sectionHeadingSchema,
  interests: sectionHeadingSchema,
  references: sectionHeadingSchema,
});

export const skillsLayoutSchema = z.strictObject({
  display: z.enum(['text', 'bars', 'detailed']),
  showLevel: z.boolean(),
  showDescription: z.boolean(),
  groupByCategory: z.boolean(),
  barValues: z
    .record(
      z
        .string()
        .min(1)
        .max(300)
        .refine((value) => !['__proto__', 'constructor', 'prototype'].includes(value)),
      z.number().min(0).max(100),
    )
    .refine(
      (values) => Object.keys(values).length <= 40,
      'Maximal 40 Balkenzuordnungen sind erlaubt.',
    ),
});

export const typographyLineHeightMin = 0.9;

/** Data-only renderer settings with bounded values; imported CSS/expressions are not supported. */
export const layoutSchema = z.strictObject({
  schemaVersion: z.literal(23),
  id,
  templateId: id,
  skills: skillsLayoutSchema,
  proficiencyPercentages: z.strictObject({
    skills: z.record(id, z.boolean()).refine((values) => Object.keys(values).length <= 100),
    languages: z.record(id, z.boolean()).refine((values) => Object.keys(values).length <= 100),
  }),
  page: z.strictObject({ format: z.literal('A4'), marginMm: z.number().min(10).max(22) }),
  appearance: z.strictObject({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    fontId: z.enum(['dm-sans', 'source-sans', 'lora']),
    fontSizePt: z.number().min(9).max(12),
    lineHeight: z.number().min(typographyLineHeightMin).max(1.8),
    spacingMm: z.number().min(3).max(9),
    sidebarSide: z.enum(['left', 'right']),
    sidebarPercent: z.number().min(25).max(36),
    headerStyle: z.enum(['solid', 'gradient']),
    photoShape: z.enum(['circle', 'rounded', 'rectangle']),
    headerEdge: z.enum(headerEdges),
    headerEdgeDepthMm: z.number().min(4).max(16),
    headerEdgeMirrored: z.boolean(),
    headerShiftUpMm: z.number().min(0).max(20),
    headerTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    headerTextOffsetMm: z.number().min(-15).max(15),
    headerNameLayout: z.enum(['stacked', 'inline']),
    leftColumnLineHeight: z.number().min(typographyLineHeightMin).max(2.4).nullable(),
    stationHeadingOrder: z
      .array(z.enum(stationHeadingFields))
      .length(stationHeadingFields.length)
      .refine(
        (items) => new Set(items).size === stationHeadingFields.length,
        'Jedes Feld des Stationskopfs muss genau einmal vorkommen.',
      ),
    timelineStyle: z.enum(['none', 'dots', 'line']),
    timelineOffsetMm: z.number().min(-10).max(12),
    timelineTextGapMm: z.number().min(2).max(14),
    stationSpacingMm: z.number().min(0).max(12),
    sectionDividers: z.boolean(),
    dividerSpacingBeforeMm: z.number().min(0).max(15),
    dividerSpacingAfterMm: z.number().min(0).max(15),
    introDividerSpacingBeforeMm: z.number().min(0).max(15),
    introDividerSpacingAfterMm: z.number().min(0).max(15),
    contactOrder: z
      .array(z.enum(contactFieldIds))
      .length(contactFieldIds.length)
      .refine(
        (items) => new Set(items).size === contactFieldIds.length,
        'Jede Kontaktangabe muss genau einmal vorkommen.',
      ),
    contactLineHeight: z.number().min(1).max(2.4),
    contactSpacingMm: z.number().min(0).max(8),
    stationDateLineHeight: z.number().min(1).max(2.4),
    stationTitleLineHeight: z.number().min(1).max(2.4),
    stationOrganizationLineHeight: z.number().min(1).max(2.4),
    stationDateTitleGapMm: z.number().min(0).max(8),
    stationTitleOrganizationGapMm: z.number().min(0).max(8),
    dividerLengthPercent: z.number().min(10).max(100).nullable(),
    headerContentGapMm: z.number().min(0).max(30),
    introBodyGapMm: z.number().min(0).max(30),
    compactWithoutSummary: z.boolean(),
    sectionHeadings: sectionHeadingsSchema,
    showContactHeading: z.boolean(),
    showRunningHeader: z.boolean(),
    showFooter: z.boolean(),
    showPhoto: z.boolean(),
    photoSide: z.enum(['left', 'right']),
    photoOverlapMm: z.number().min(0).max(20),
    photoOffsetMm: z.number().min(-15).max(15),
    headerImageAssetId: id.nullable(),
    headerImageDimPercent: z.number().min(0).max(80),
    headerImageTransparencyPercent: z.number().min(0).max(100),
    photoWidthMm: z.number().min(24).max(60),
    photoBorderWidthMm: z.number().min(0).max(4),
    photoBorderColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    photoFit: z.enum(['cover', 'contain']),
    photoPositionX: z.number().min(0).max(100),
    photoPositionY: z.number().min(0).max(100),
  }),
  sections: z
    .array(
      z.strictObject({
        id: z.enum(sectionIds),
        region: z.enum(['main', 'sidebar']),
        enabled: z.boolean(),
      }),
    )
    .length(sectionIds.length)
    .refine(
      (items) => new Set(items.map((item) => item.id)).size === sectionIds.length,
      'Jeder Abschnitt muss genau einmal vorkommen.',
    ),
});

export type SkillsLayout = z.infer<typeof skillsLayoutSchema>;

export type Layout = z.infer<typeof layoutSchema>;
