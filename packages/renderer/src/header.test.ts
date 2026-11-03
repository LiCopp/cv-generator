import { describe, expect, it } from 'vitest';
import { headerClipPath } from './header';

describe('header outlines', () => {
  it('retains full diagonal endpoints and reverses their direction', () => {
    expect(headerClipPath('diagonal', 16, false)).toBe(
      'polygon(0 0, 100% 0, 100.000000% calc(100% - 16.000000mm), 0.000000% calc(100% - 0.000000mm))',
    );
    expect(headerClipPath('diagonal', 16, true)).toBe(
      'polygon(0 0, 100% 0, 100.000000% calc(100% - 0.000000mm), 0.000000% calc(100% - 16.000000mm))',
    );
  });
  it('mirrors asymmetrical curves and leaves symmetrical shapes unchanged', () => {
    expect(headerClipPath('wave', 4, true)).not.toBe(headerClipPath('wave', 4, false));
    for (const edge of ['straight', 'arc', 'chevron'] as const)
      expect(headerClipPath(edge, 16, true)).toBe(headerClipPath(edge, 16, false));
    expect(headerClipPath('chevron', 4, false)).toContain('50.000000% calc(100% - 0.000000mm)');
  });
});
