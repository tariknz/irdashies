import { describe, expect, it } from 'vitest';
import { resolveDamageBodyStyle } from './bodyStyle';

describe('resolveDamageBodyStyle', () => {
  it('maps lovely-car-data classes', () => {
    expect(resolveDamageBodyStyle('ferrari296gt3', 'GT3')).toBe('gt');
    expect(resolveDamageBodyStyle('dallarap217', 'GTP')).toBe('prototype');
    expect(resolveDamageBodyStyle('formularenault20', 'F2.0')).toBe('openwheel');
    expect(resolveDamageBodyStyle('mx5cup', 'MX5')).toBe('hatch');
    expect(resolveDamageBodyStyle('stockcarnetc', 'Gen4')).toBe('stock');
    expect(resolveDamageBodyStyle('pro2truck', 'ORE')).toBe('truck');
  });

  it('falls back to path keywords when class is missing', () => {
    expect(resolveDamageBodyStyle('ray_ff1600', undefined, 'Ray FF1600')).toBe(
      'openwheel'
    );
    expect(
      resolveDamageBodyStyle('ferrari_499p', undefined, 'Ferrari 499P')
    ).toBe('prototype');
    expect(resolveDamageBodyStyle('mx5', undefined, 'Mazda MX-5')).toBe('hatch');
  });

  it('defaults to gt', () => {
    expect(resolveDamageBodyStyle(undefined, undefined, undefined)).toBe('gt');
  });
});
