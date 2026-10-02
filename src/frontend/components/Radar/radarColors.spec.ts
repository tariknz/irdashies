import { describe, expect, it } from 'vitest';
import { licenceColor, paler, rivalFill, textColorFor } from './radarColors';

describe('radarColors', () => {
  it('colours rivals by licence like the rating badge', () => {
    expect(licenceColor('B 2.45', 1800)).toBe('#22c55e');
    expect(licenceColor('P 4.99', 6000)).toBe('#a855f7');
    expect(licenceColor('R 1.00', 900)).toBe('#ef4444');
  });

  it('shows AI drivers, with no rating, as A like the badge', () => {
    expect(licenceColor('R 0.00', 0)).toBe('#3b82f6');
    expect(licenceColor(undefined, undefined)).toBe('#3b82f6');
  });

  it('washes a colour out towards grey', () => {
    expect(paler('#ffffff')).toBe('#dadfe6');
    expect(paler('#000000')).toBe('#343940');
  });

  it('picks the fill for each mode', () => {
    const source = { license: 'C 3.00', rating: 1500, classColor: '#33ceff' };
    expect(rivalFill('safety', '#aaaaaa', source)).toBe('#eab308');
    expect(rivalFill('class', '#aaaaaa', source)).toBe('#33ceff');
    expect(rivalFill('class', '#aaaaaa', {})).toBe('#aaaaaa');
    expect(rivalFill('custom', '#aaaaaa', source)).toBe('#aaaaaa');
  });

  it('keeps numbers readable on light and dark fills', () => {
    expect(textColorFor('#ffffff')).toBe('#0f172a');
    expect(textColorFor('#1e40af')).toBe('#ffffff');
  });
});
