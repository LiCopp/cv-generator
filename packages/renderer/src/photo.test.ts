import { describe, expect, it } from 'vitest';
import { createProject } from '@cv/core';
import { photoObjectPosition } from './photo';

describe('photo positioning', () => {
  it('allows vertical movement for a portrait fitted to the full frame height', () => {
    const appearance = createProject('student').layout.appearance;
    Object.assign(appearance, {
      photoWidthMm: 40,
      photoBorderWidthMm: 0.6,
      photoFit: 'contain',
      photoPositionX: 55,
      photoPositionY: 25,
    });
    expect(photoObjectPosition(appearance, 624, 800)).toBe('55% calc(50% + -9.700000mm)');
    appearance.photoPositionY = 50;
    expect(photoObjectPosition(appearance, 624, 800)).toBe('55% 50%');
  });
  it('preserves existing alignment on axes with crop or spare space', () => {
    const appearance = createProject('student').layout.appearance;
    Object.assign(appearance, {
      photoWidthMm: 40,
      photoBorderWidthMm: 0.6,
      photoFit: 'cover',
      photoPositionX: 50,
      photoPositionY: 25,
    });
    expect(photoObjectPosition(appearance, 624, 800)).toBe('50% 25%');
    Object.assign(appearance, { photoFit: 'contain', photoPositionX: 25, photoPositionY: 50 });
    expect(photoObjectPosition(appearance, 624, 800)).toBe('25% 50%');
  });
  it('applies the same bounded movement horizontally and with other shapes and borders', () => {
    const appearance = createProject('student').layout.appearance;
    Object.assign(appearance, {
      photoWidthMm: 60,
      photoBorderWidthMm: 4,
      photoShape: 'rectangle',
      photoFit: 'contain',
      photoPositionX: 100,
      photoPositionY: 0,
    });
    expect(photoObjectPosition(appearance, 800, 400)).toBe('calc(50% + 26.000000mm) 0%');
    expect(photoObjectPosition(appearance, 0, 0)).toBe('100% 0%');
  });
});
