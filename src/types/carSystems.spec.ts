import { describe, expect, it } from 'vitest';
import {
  CAR_SYSTEM_ADJUSTMENTS,
  CAR_SYSTEM_LABEL_OVERRIDES,
  DEFAULT_CAR_SYSTEM_ROWS,
  carSystemIsRenamedSomewhere,
  normalizeCarPath,
  resolveCarSystemDefinition,
} from './carSystems';

const definitionFor = (key: string) => {
  const definition = CAR_SYSTEM_ADJUSTMENTS.find((d) => d.key === key);
  if (!definition) throw new Error(`no catalogue entry for ${key}`);
  return definition;
};

describe('normalizeCarPath', () => {
  it('ignores case and punctuation', () => {
    expect(normalizeCarPath('DallaraP217')).toBe('dallarap217');
    expect(normalizeCarPath('dallara p217')).toBe('dallarap217');
    expect(normalizeCarPath('dallara-p217')).toBe('dallarap217');
  });
});

describe('resolveCarSystemDefinition', () => {
  const abs = definitionFor('dcABS');

  it('keeps the catalogue name for a car with no override', () => {
    expect(resolveCarSystemDefinition(abs, 'bmwm4gt3')).toEqual(abs);
  });

  it('keeps the catalogue name before session data names the car', () => {
    expect(resolveCarSystemDefinition(abs, undefined)).toEqual(abs);
    expect(resolveCarSystemDefinition(abs, '')).toEqual(abs);
  });

  it('renames a channel the car wires to a different control', () => {
    const resolved = resolveCarSystemDefinition(abs, 'dallarap217');

    expect(resolved.label).toBe('Brake Migration');
    expect(resolved.short).toBe('MIGR');
  });

  it('renames only the adjustments the car overrides', () => {
    const bias = definitionFor('dcBrakeBias');

    expect(resolveCarSystemDefinition(bias, 'dallarap217')).toEqual(bias);
  });

  it('keeps the telemetry key, so a saved row selection still matches', () => {
    // The whole point of overriding display strings alone: `rows` persists
    // keys, so switching into an overriding car must not orphan the row.
    const resolved = resolveCarSystemDefinition(abs, 'dallarap217');

    expect(resolved.key).toBe('dcABS');
    expect(DEFAULT_CAR_SYSTEM_ROWS).toContain(resolved.key);
  });

  it('leaves the scale and formatting alone', () => {
    const resolved = resolveCarSystemDefinition(abs, 'dallarap217');

    expect(resolved.precision).toBe(abs.precision);
    expect(resolved.unit).toBe(abs.unit);
    expect(resolved.chip).toBe(abs.chip);
    expect(resolved.signed).toBe(abs.signed);
  });
});

describe('CAR_SYSTEM_LABEL_OVERRIDES', () => {
  it('only overrides keys the catalogue knows about', () => {
    // A typo'd key would silently never match, so it is caught here rather
    // than by a column that quietly keeps its generic name in the sim.
    const known = new Set(CAR_SYSTEM_ADJUSTMENTS.map((d) => d.key));

    for (const [carPath, overrides] of Object.entries(
      CAR_SYSTEM_LABEL_OVERRIDES
    )) {
      for (const key of Object.keys(overrides)) {
        expect(known, `${carPath} overrides unknown key ${key}`).toContain(key);
      }
    }
  });

  it('is keyed by already-normalized car paths', () => {
    for (const carPath of Object.keys(CAR_SYSTEM_LABEL_OVERRIDES)) {
      expect(normalizeCarPath(carPath)).toBe(carPath);
    }
  });
});

describe('carSystemIsRenamedSomewhere', () => {
  it('reports the keys settings should caveat', () => {
    expect(carSystemIsRenamedSomewhere('dcABS')).toBe(true);
    expect(carSystemIsRenamedSomewhere('dcBrakeBias')).toBe(false);
  });
});
