import { describe, expect, it } from 'vitest';
import { formatClassLabel } from './formatClassLabel';

describe('formatClassLabel', () => {
  it.each([
    ['GTP', 'GTP'],
    ['LMP2', 'LMP2'],
    ['LMP3', 'LMP3'],
    ['Hypercar', 'HYPR'],
    ['LMGT3', 'LGT3'],
    ['LMGTE', 'LGTE'],
    ['Supercars - 2019', 'SUPR'],
    ['Hosted All Cars', 'HAC'],
    ['Ligier JS P320', 'P320'],
    ['Dallara IL15', 'IL15'],
    ['Dallara P217', 'P217'],
    ['MX5 Cup 2016', 'MX5'],
    ['Renault Clio', 'RC'],
    ['Toyota GR86', 'GR86'],
    ['Formula Vee', 'FV'],
    ['Ray FF1600', 'FF16'],
    ['BMW M4 GT4', 'GT4'],
    ['GT3 Class', 'GT3'],
    ['GT4 Class', 'GT4'],
    ['GT3 2025', 'GT3'],
    ['Legends', 'LGND'],
    ['IMSA23', 'IMSA'],
    ['Unknown future class with a much longer name', 'UFWA'],
    ['  gt3 class  ', 'GT3'],
    ['WWWWWWWWWWWW', 'WWWW'],
    [undefined, '—'],
    [null, '—'],
    ['', '—'],
    ['  ', '—'],
  ])('formats %s as %s', (name, expected) => {
    expect(formatClassLabel(name)).toBe(expected);
    expect(formatClassLabel(name).length).toBeLessThanOrEqual(4);
  });
});
