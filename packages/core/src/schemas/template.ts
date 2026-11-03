import { z } from 'zod';
import { sectionIds } from '../sections';
import { id, shortText } from './primitives';

export const templateSchema = z.strictObject({
  schemaVersion: z.literal(2),
  id,
  version: z.literal('1.1.0'),
  name: shortText,
  regions: z.array(z.enum(['header', 'main', 'sidebar', 'footer'])),
  components: z.array(z.enum(sectionIds)),
  defaultLayoutId: id,
});
