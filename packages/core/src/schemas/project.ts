import { z } from 'zod';
import { cvSchema } from './cv';
import { layoutSchema } from './layout';
import { id } from './primitives';
import { templateSchema } from './template';

export const currentRendererVersion = '1.28.0';

export const manifestSchema = z.strictObject({
  format: z.literal('folio-json'),
  formatVersion: z.literal(1),
  rendererVersion: z.enum([
    '1.0.0',
    '1.1.0',
    '1.2.0',
    '1.3.0',
    '1.4.0',
    '1.5.0',
    '1.6.0',
    '1.7.0',
    '1.8.0',
    '1.9.0',
    '1.9.1',
    '1.10.0',
    '1.11.0',
    '1.11.1',
    '1.12.0',
    '1.13.0',
    '1.14.0',
    '1.15.0',
    '1.15.1',
    '1.16.0',
    '1.17.0',
    '1.18.0',
    '1.19.0',
    '1.20.0',
    '1.21.0',
    '1.22.0',
    '1.23.0',
    '1.24.0',
    '1.25.0',
    '1.25.1',
    '1.25.2',
    '1.25.3',
    '1.26.0',
    '1.27.0',
    '1.27.1',
    '1.27.2',
    currentRendererVersion,
  ]),
});

const rasterAsset = z.strictObject({
  mediaType: z.literal('image/png'),
  data: z
    .string()
    .max(2_800_000)
    .regex(/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/),
});

/** Validate resource shapes first, then verify cross-resource IDs and supported placements. */
export const projectSchema = z
  .strictObject({
    manifest: manifestSchema,
    cv: cvSchema,
    template: templateSchema,
    layout: layoutSchema,
    assets: z
      .record(id, rasterAsset)
      .refine((assets) => Object.keys(assets).length <= 4, 'Maximal vier Bilder sind erlaubt.'),
  })
  .superRefine((project, ctx) => {
    if (project.template.id !== project.layout.templateId)
      ctx.addIssue({
        code: 'custom',
        path: ['layout', 'templateId'],
        message: 'Vorlage und Layout passen nicht zusammen.',
      });
    if (project.cv.contact.photoAssetId && !project.assets[project.cv.contact.photoAssetId])
      ctx.addIssue({ code: 'custom', path: ['assets'], message: 'Das referenzierte Foto fehlt.' });
    if (
      project.layout.appearance.headerImageAssetId &&
      !project.assets[project.layout.appearance.headerImageAssetId]
    )
      ctx.addIssue({
        code: 'custom',
        path: ['assets'],
        message: 'Das referenzierte Headerbild fehlt.',
      });
    for (const section of project.layout.sections) {
      if (
        !project.template.components.includes(section.id) ||
        !project.template.regions.includes(section.region)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['layout', 'sections'],
          message: 'Die Vorlage unterstützt diesen Abschnitt oder Bereich nicht.',
        });
    }
  });

export type Project = z.infer<typeof projectSchema>;
