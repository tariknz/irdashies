import { describe, expect, it } from 'vitest';
import {
  getPath,
  isConfigValid,
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
