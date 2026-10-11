import { describe, expect, it } from 'vitest';
import {
  getPath,
  isConfigValid,
  isValidPropertyValue,
  numberOptions,
  sessionVisibilityProperties,
  setPath,
  type PropertySpecs,
} from './properties';
import { WIDGET_MANIFESTS } from './index';

const specs: PropertySpecs = {
  'background.opacity': { type: 'number', label: 'Opacity', min: 0, max: 100 },
  units: {
    type: 'enum',
    label: 'Units',
    options: [
      { value: 'Metric', label: 'km/h' },
      { value: 'Imperial', label: 'mph' },
    ],
  },
  show: { type: 'boolean', label: 'Show' },
};

describe('widget properties', () => {
  it('reads and writes dotted paths without touching siblings', () => {
    const config = { background: { opacity: 80, blur: 2 }, units: 'Metric' };
    expect(getPath(config, 'background.opacity')).toBe(80);
    expect(getPath(config, 'background.__proto__')).toBeUndefined();
    expect(setPath(config, 'background.opacity', 50)).toEqual({
      background: { opacity: 50, blur: 2 },
      units: 'Metric',
    });
    expect(config.background.opacity).toBe(80);
  });

  it('accepts a config only when every declared property is valid', () => {
    const valid = { background: { opacity: 80 }, units: 'Metric', show: true };
    expect(isConfigValid(specs, valid)).toBe(true);
    expect(isConfigValid(specs, { ...valid, units: 'Furlongs' })).toBe(false);
    expect(isConfigValid(specs, { ...valid, show: 'yes' })).toBe(false);
    expect(isConfigValid(specs, { ...valid, background: null })).toBe(false);
    expect(isConfigValid(specs, null)).toBe(false);
  });

  // A typo in a property path would otherwise only show up as a missing row.
  it.each(WIDGET_MANIFESTS.filter((m) => m.properties))(
    '$id: declared properties match its default config',
    (manifest) => {
      for (const path of Object.keys(manifest.properties ?? {})) {
        expect(getPath(manifest.config, path), path).not.toBeUndefined();
      }
      expect(isConfigValid(manifest.properties ?? {}, manifest.config)).toBe(
        true
      );
    }
  );
});

describe('property paths', () => {
  it.each([undefined, null, false, 0, 'value', []])(
    'returns undefined when a path crosses a non-record: %j',
    (child) => {
      expect(getPath({ child }, 'child.value')).toBeUndefined();
      expect(getPath(child, 'value')).toBeUndefined();
    }
  );

  it('does not read inherited properties at any depth', () => {
    const inherited = Object.create({ opacity: 80 });
    expect(getPath(inherited, 'opacity')).toBeUndefined();
    expect(
      getPath({ background: inherited }, 'background.opacity')
    ).toBeUndefined();
    expect(getPath({}, 'constructor.prototype')).toBeUndefined();
  });

  it.each([undefined, null, false, 42, 'legacy', []])(
    'creates missing branches over a non-record: %j',
    (background) => {
      const config = { background, units: 'Metric' };
      expect(setPath(config, 'background.nested.opacity', 0)).toEqual({
        background: { nested: { opacity: 0 } },
        units: 'Metric',
      });
      expect(config.background).toBe(background);
    }
  );

  it('copies each changed ancestor and retains untouched branches', () => {
    const untouched = { enabled: true };
    const config = {
      background: { nested: { opacity: 80, blur: 2 }, color: 'black' },
      untouched,
    };
    const result = setPath(config, 'background.nested.opacity', 0);
    expect(result).toEqual({
      background: { nested: { opacity: 0, blur: 2 }, color: 'black' },
      untouched,
    });
    expect(result).not.toBe(config);
    expect(result.background).not.toBe(config.background);
    expect(getPath(result, 'background.nested')).not.toBe(
      config.background.nested
    );
    expect(result.untouched).toBe(untouched);
    expect(config.background.nested.opacity).toBe(80);
  });
});

describe('property validation', () => {
  it.each([NaN, Infinity, -Infinity, '50', null, undefined, true, {}, []])(
    'rejects a non-finite or non-numeric number value: %j',
    (value) => {
      expect(isValidPropertyValue(specs['background.opacity'], value)).toBe(
        false
      );
    }
  );

  it.each([0, 100, 0.5])(
    'accepts finite numeric values including %s',
    (value) => {
      expect(isValidPropertyValue(specs['background.opacity'], value)).toBe(
        true
      );
    }
  );

  it.each([true, false])('accepts the boolean %s', (value) => {
    expect(isValidPropertyValue(specs.show, value)).toBe(true);
  });

  it.each([0, 1, '', 'false', null, undefined])(
    'rejects boolean coercion of %j',
    (value) => {
      expect(isValidPropertyValue(specs.show, value)).toBe(false);
    }
  );

  it('matches numeric enum values without coercing strings', () => {
    const spec = {
      type: 'enum',
      label: 'Laps',
      options: numberOptions(0, 2),
    } as const;
    expect(isValidPropertyValue(spec, 0)).toBe(true);
    expect(isValidPropertyValue(spec, 2)).toBe(true);
    expect(isValidPropertyValue(spec, '0')).toBe(false);
    expect(isValidPropertyValue(spec, 3)).toBe(false);
  });

  it.each([undefined, null, [], 'config', 1, false])(
    'rejects a non-record config even without properties: %j',
    (value) => {
      expect(isConfigValid({}, value)).toBe(false);
    }
  );

  it('accepts extra custom settings but rejects missing declared fields', () => {
    const valid = {
      background: { opacity: 0 },
      units: 'Metric',
      show: false,
      custom: ['extra'],
    };
    expect(isConfigValid(specs, valid)).toBe(true);
    expect(
      isConfigValid(specs, { background: { opacity: 0 }, units: 'Metric' })
    ).toBe(false);
    expect(isConfigValid({}, {})).toBe(true);
  });
});

describe('property factories', () => {
  it('generates inclusive numeric options with string labels', () => {
    expect(numberOptions(-1, 1)).toEqual([
      { value: -1, label: '-1' },
      { value: 0, label: '0' },
      { value: 1, label: '1' },
    ]);
    expect(numberOptions(3, 3)).toEqual([{ value: 3, label: '3' }]);
    expect(numberOptions(3, 2)).toEqual([]);
  });

  it('declares the standard session toggles without opting into warmup', () => {
    expect(sessionVisibilityProperties()).toEqual({
      'sessionVisibility.race': { type: 'boolean', label: 'Race' },
      'sessionVisibility.loneQualify': {
        type: 'boolean',
        label: 'Lone Qualify',
      },
      'sessionVisibility.openQualify': {
        type: 'boolean',
        label: 'Open Qualify',
      },
      'sessionVisibility.practice': { type: 'boolean', label: 'Practice' },
      'sessionVisibility.offlineTesting': {
        type: 'boolean',
        label: 'Offline Testing',
      },
    });
  });

  it('supports a custom session subset and an empty subset', () => {
    expect(sessionVisibilityProperties(['warmup', 'race'])).toEqual({
      'sessionVisibility.warmup': { type: 'boolean', label: 'Warmup' },
      'sessionVisibility.race': { type: 'boolean', label: 'Race' },
    });
    expect(sessionVisibilityProperties([])).toEqual({});
  });
});
