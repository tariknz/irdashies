import { describe, expect, it } from 'vitest';
import { resolveDamageBodyStyle } from './bodyStyle';

describe('resolveDamageBodyStyle', () => {
  it('maps lovely-car-data classes', () => {
    expect(resolveDamageBodyStyle('ferrari296gt3', 'GT3')).toBe('gtMid');
    expect(resolveDamageBodyStyle('dallarap217', 'GTP')).toBe('prototype');
    expect(resolveDamageBodyStyle('formularenault20', 'F2.0')).toBe(
      'openwheel'
    );
    expect(resolveDamageBodyStyle('mx5cup', 'MX5')).toBe('hatch');
    expect(resolveDamageBodyStyle('stockcarnetc', 'Gen4')).toBe('stock');
    expect(resolveDamageBodyStyle('pro2truck', 'ORE')).toBe('truck');
  });

  it('splits GT by engine layout', () => {
    expect(resolveDamageBodyStyle('bmwm4gt3', 'GT3', 'BMW M4 GT3')).toBe(
      'gtFront'
    );
    expect(
      resolveDamageBodyStyle('mercedesamgevogt3', 'GT3', 'Mercedes AMG EVO GT3')
    ).toBe('gtFront');
    expect(
      resolveDamageBodyStyle('fordmustanggt3', 'GT3', 'Ford Mustang GT3')
    ).toBe('gtFront');
    expect(
      resolveDamageBodyStyle('ferrari296gt3', 'GT3', 'Ferrari 296 GT3')
    ).toBe('gtMid');
    expect(
      resolveDamageBodyStyle('mclaren720sgt3', 'GT3', 'McLaren 720S GT3')
    ).toBe('gtMid');
    expect(
      resolveDamageBodyStyle('audir8lmsevo2gt3', 'GT3', 'Audi R8 LMS EVO2')
    ).toBe('gtMid');
    expect(
      resolveDamageBodyStyle('porsche992rgt3', 'GT3', 'Porsche 992R GT3')
    ).toBe('gtRear');
    expect(
      resolveDamageBodyStyle('porsche991rsr', 'GTE', 'Porsche 991RSR')
    ).toBe('gtRear');
  });

  it('falls back to path keywords when class is missing', () => {
    expect(resolveDamageBodyStyle('ray_ff1600', undefined, 'Ray FF1600')).toBe(
      'openwheel'
    );
    expect(
      resolveDamageBodyStyle('ferrari_499p', undefined, 'Ferrari 499P')
    ).toBe('prototype');
    expect(resolveDamageBodyStyle('mx5', undefined, 'Mazda MX-5')).toBe(
      'hatch'
    );
  });

  it('defaults to gt mid-engine', () => {
    expect(resolveDamageBodyStyle(undefined, undefined, undefined)).toBe(
      'gtMid'
    );
  });
});
