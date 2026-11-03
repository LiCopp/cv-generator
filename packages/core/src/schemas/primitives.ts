import { z } from 'zod';

export const text = z.string().max(20_000);

export const shortText = z.string().max(300);

export const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .refine((value) => !['__proto__', 'constructor', 'prototype'].includes(value), 'Ungültige ID.');
