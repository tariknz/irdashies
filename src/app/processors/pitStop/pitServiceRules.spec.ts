import { describe, expect, it } from 'vitest';
import {
  findTableRow,
  resolveTableRule,
  ruleFamilyFromTag,
  ruleSetKey,
} from './pitServiceRules';

describe('ruleFamilyFromTag', () => {
  it.each([
    [null, 'default'],
    [undefined, 'default'],
    ['', 'default'],
    ['IMSA', 'imsa'],
    ['imsa23', 'imsa'],
    ['NEC', 'nec'],
    ['DTM', 'dtm'],
    ['WSC2017', 'default'],
  ])('maps %s to %s', (tag, family) => {
    expect(ruleFamilyFromTag(tag)).toBe(family);
  });
});

describe('ruleSetKey', () => {
  it('lower-cases the tag and uses default when absent', () => {
    expect(ruleSetKey('IMSA')).toBe('imsa');
    expect(ruleSetKey(null)).toBe('default');
    expect(ruleSetKey('  ')).toBe('default');
  });
});

describe('findTableRow', () => {
  it.each([
    ['porsche963gtp', 'gtp'],
    ['bmwlmdh', 'gtp'],
    ['ferrari499p', 'gtp'],
    ['dallarap217', 'lmp2'],
    ['ligierjsp320', 'lmp3'],
    ['ferrari296gt3', 'gt3'],
    ['porsche992rgt3', 'gt3'],
    ['bmwm4evogt4', 'gt4'],
    ['mx5 mx52016', 'production'],
    ['toyotagr86', 'production'],
    ['renaultcliocup', 'production'],
    ['radical sr8', 'radical'],
  ])('matches %s to %s', (carPath, rowId) => {
    expect(findTableRow(carPath)?.id).toBe(rowId);
  });

  it.each([
    'safety pcporsche911cup',
    'dallarail15',
    'formulavee',
    'legends ford34c',
  ])('has no row for %s', (carPath) => {
    expect(findTableRow(carPath)).toBeNull();
  });
});

describe('resolveTableRule', () => {
  it('uses fuel then tyres under default rules', () => {
    const result = resolveTableRule('ferrari296gt3', 'default', 100);
    expect(result).toMatchObject({
      rowId: 'gt3',
      family: 'default',
      source: 'table',
      rule: { fourTyreSeconds: 20, sequencing: 'fuelThenTyres' },
    });
    expect(result?.rule.fuelLitresPerSecond).toBeCloseTo(2.5);
  });

  it('runs fuel and tyres together under IMSA with default times', () => {
    const result = resolveTableRule('ferrari296gt3', 'imsa', 100);
    expect(result?.rule.sequencing).toBe('simultaneous');
    expect(result?.rule.fuelLitresPerSecond).toBeCloseTo(2.5);
  });

  it('uses a 120 s fill under NEC for supported cars', () => {
    const result = resolveTableRule('toyotagr86', 'nec', 50);
    expect(result).toMatchObject({ family: 'nec', source: 'table' });
    expect(result?.rule.fuelLitresPerSecond).toBeCloseTo(50 / 120);
    expect(result?.rule.fourTyreSeconds).toBe(40);
  });

  it('falls back to default rules under NEC for unsupported cars', () => {
    const result = resolveTableRule('porsche963gtp', 'nec', 100);
    expect(result).toMatchObject({
      family: 'default',
      source: 'tableDefault',
      rule: { sequencing: 'fuelThenTyres' },
    });
  });

  it('uses the DTM fill and tyre times for GT3 only', () => {
    expect(resolveTableRule('bmwm4gt3', 'dtm', 100)).toMatchObject({
      family: 'dtm',
      rule: { fourTyreSeconds: 7, sequencing: 'simultaneous' },
    });
    expect(resolveTableRule('bmwm4gt4', 'dtm', 100)).toMatchObject({
      family: 'default',
      source: 'tableDefault',
    });
  });

  it('returns null without a row or a tank size', () => {
    expect(resolveTableRule('dallarail15', 'default', 100)).toBeNull();
    expect(resolveTableRule('bmwm4gt3', 'default', 0)).toBeNull();
  });
});
