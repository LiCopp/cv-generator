import { describe, expect, it } from 'vitest';
import { continueBullet, toggleBold, toggleBullets } from './description-editing';

describe('description toolbar editing', () => {
  it('wraps and unwraps a selection and inserts a selected placeholder at the caret', () => {
    const edit = toggleBold('Ein starkes Team', 4, 11);
    expect(edit).toEqual({ value: 'Ein **starkes** Team', start: 6, end: 13 });
    expect(toggleBold(edit.value, edit.start, edit.end)).toEqual({
      value: 'Ein starkes Team',
      start: 4,
      end: 11,
    });
    expect(toggleBold('**Team**', 0, 8).value).toBe('Team');
    expect(toggleBold('', 0, 0)).toEqual({ value: '**Text**', start: 2, end: 6 });
    expect(toggleBold('- Team\n- Erfolg', 0, 15).value).toBe('- **Team**\n- **Erfolg**');
  });
  it('toggles selected complete lines without altering adjacent lines, blank lines or existing markers', () => {
    const value = 'Intro\nPlanung\n\n- Umsetzung\nEnde';
    const edit = toggleBullets(value, 7, 25);
    expect(edit.value).toBe('Intro\n- Planung\n\n- Umsetzung\nEnde');
    expect(toggleBullets(edit.value, edit.start, edit.end).value).toBe(
      'Intro\nPlanung\n\nUmsetzung\nEnde',
    );
    expect(toggleBullets('Erste\nZweite', 0, 6).value).toBe('- Erste\nZweite');
    expect(toggleBullets('\nZweite', 0, 0).value).toBe('- \nZweite');
    expect(toggleBullets('', 0, 0)).toEqual({ value: '- ', start: 0, end: 2 });
  });
  it('continues a list and ends it on an empty item while leaving normal Enter alone', () => {
    expect(continueBullet('- Planung', 9, 9)).toEqual({
      value: '- Planung\n- ',
      start: 12,
      end: 12,
    });
    expect(continueBullet('- Planung\n- ', 12, 12)).toEqual({
      value: '- Planung\n',
      start: 10,
      end: 10,
    });
    expect(continueBullet('Normal', 6, 6)).toBeNull();
    expect(continueBullet('- Planung', 3, 3)).toBeNull();
  });
});
