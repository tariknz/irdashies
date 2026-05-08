import { describe, it, expect } from 'vitest';
import { deepMergeConfig, getWidgetDefaultConfig } from './defaultDashboard';

describe('deepMergeConfig', () => {
  describe('invalid savedCfg', () => {
    it('returns a copy of defaultCfg when savedCfg is null', () => {
      const def = { a: 1, b: 'x' };
      expect(deepMergeConfig(def, null)).toEqual(def);
    });

    it('returns a copy of defaultCfg when savedCfg is undefined', () => {
      const def = { a: 1 };
      expect(deepMergeConfig(def, undefined)).toEqual(def);
    });

    it('returns a copy of defaultCfg when savedCfg is an array', () => {
      const def = { a: 1 };
      expect(deepMergeConfig(def, [1, 2, 3])).toEqual(def);
    });

    it('returns a copy of defaultCfg when savedCfg is a primitive', () => {
      const def = { a: 1 };
      expect(deepMergeConfig(def, 42 as unknown as object)).toEqual(def);
    });

    it('does not mutate defaultCfg when savedCfg is invalid', () => {
      const def = { a: 1 };
      const result = deepMergeConfig(def, null);
      result.a = 99;
      expect(def.a).toBe(1);
    });
  });

  describe('missing fields', () => {
    it('fills in missing fields from defaultCfg', () => {
      const def = { a: 1, b: 2, c: 3 };
      const saved = { a: 10 };
      expect(deepMergeConfig(def, saved)).toEqual({ a: 10, b: 2, c: 3 });
    });

    it('preserves all user-saved scalar values', () => {
      const def = { enabled: false, fontSize: 14, channel: '' };
      const saved = { enabled: true, fontSize: 20, channel: 'mychannel' };
      expect(deepMergeConfig(def, saved)).toEqual(saved);
    });

    it('preserves user values for boolean false (not treated as missing)', () => {
      const def = { enabled: true };
      const saved = { enabled: false };
      expect(deepMergeConfig(def, saved)).toEqual({ enabled: false });
    });

    it('preserves user values for zero', () => {
      const def = { opacity: 40 };
      const saved = { opacity: 0 };
      expect(deepMergeConfig(def, saved)).toEqual({ opacity: 0 });
    });

    it('preserves keys from savedCfg not present in defaultCfg', () => {
      const def = { a: 1 };
      const saved = { a: 2, newField: 'hello' };
      expect(deepMergeConfig(def, saved)).toEqual({ a: 2, newField: 'hello' });
    });
  });

  describe('nested objects', () => {
    it('recursively merges nested objects', () => {
      const def = { background: { opacity: 40, color: 'black' } };
      const saved = { background: { opacity: 80 } };
      expect(deepMergeConfig(def, saved)).toEqual({
        background: { opacity: 80, color: 'black' },
      });
    });

    it('fills missing nested fields from default', () => {
      const def = {
        trace: { enabled: true, includeThrottle: true, includeBrake: true },
      };
      const saved = { trace: { enabled: false } };
      expect(deepMergeConfig(def, saved)).toEqual({
        trace: { enabled: false, includeThrottle: true, includeBrake: true },
      });
    });

    it('handles deeply nested objects', () => {
      const def = { a: { b: { c: 1, d: 2 } } };
      const saved = { a: { b: { c: 99 } } };
      expect(deepMergeConfig(def, saved)).toEqual({
        a: { b: { c: 99, d: 2 } },
      });
    });

    it('replaces default object with saved value if saved is not an object', () => {
      const def = { background: { opacity: 40 } };
      const saved = { background: null };
      expect(deepMergeConfig(def, saved)).toEqual({ background: null });
    });
  });

  describe('arrays', () => {
    it('replaces non-displayOrder arrays entirely', () => {
      const def = { items: [1, 2, 3] };
      const saved = { items: [4, 5] };
      expect(deepMergeConfig(def, saved)).toEqual({ items: [4, 5] });
    });

    it('does not merge array elements for non-displayOrder keys', () => {
      const def = { colors: ['red', 'blue', 'green'] };
      const saved = { colors: ['yellow'] };
      expect(deepMergeConfig(def, saved)).toEqual({ colors: ['yellow'] });
    });
  });

  describe('displayOrder merging', () => {
    it('preserves user order when all items present', () => {
      const def = { displayOrder: ['a', 'b', 'c'] };
      const saved = { displayOrder: ['c', 'a', 'b'] };
      expect(deepMergeConfig(def, saved)).toEqual({
        displayOrder: ['c', 'a', 'b'],
      });
    });

    it('inserts newly added item at its default position', () => {
      // User has ['a', 'c'] and 'b' was added to defaults between a and c
      const def = { displayOrder: ['a', 'b', 'c'] };
      const saved = { displayOrder: ['a', 'c'] };
      expect(deepMergeConfig(def, saved)).toEqual({
        displayOrder: ['a', 'b', 'c'],
      });
    });

    it('appends new item at end when no anchor found', () => {
      // Default adds 'd' after c, but user has no items after c
      const def = { displayOrder: ['a', 'b', 'c', 'd'] };
      const saved = { displayOrder: ['b', 'a'] };
      expect(deepMergeConfig(def, saved)).toEqual({
        displayOrder: ['b', 'a', 'c', 'd'],
      });
    });

    it('inserts multiple new items at their correct positions', () => {
      const def = { displayOrder: ['a', 'b', 'c', 'd', 'e'] };
      const saved = { displayOrder: ['a', 'e'] };
      expect(deepMergeConfig(def, saved)).toEqual({
        displayOrder: ['a', 'b', 'c', 'd', 'e'],
      });
    });

    it('handles nested displayOrder (e.g. headerBar.displayOrder)', () => {
      const def = {
        headerBar: { displayOrder: ['sessionName', 'sessionTime', 'newItem'] },
      };
      const saved = {
        headerBar: { displayOrder: ['sessionName', 'sessionTime'] },
      };
      expect(deepMergeConfig(def, saved)).toEqual({
        headerBar: { displayOrder: ['sessionName', 'sessionTime', 'newItem'] },
      });
    });
  });

  describe('does not mutate inputs', () => {
    it('does not mutate defaultCfg', () => {
      const def = { a: 1, b: { c: 2 } };
      const saved = { b: { c: 99 } };
      deepMergeConfig(def, saved);
      expect(def.b.c).toBe(2);
    });

    it('does not mutate savedCfg', () => {
      const def = { a: 1 };
      const saved: Record<string, unknown> = { a: 2 };
      deepMergeConfig(def, saved);
      expect(saved.a).toBe(2);
    });
  });
});

describe('getWidgetDefaultConfig', () => {
  it('returns the standings config', () => {
    const config = getWidgetDefaultConfig('standings');
    expect(config).toBeDefined();
    expect(config.background).toBeDefined();
    expect(config.displayOrder).toBeDefined();
  });

  it('returns the fuel config', () => {
    const config = getWidgetDefaultConfig('fuel');
    expect(config).toBeDefined();
    expect(config.fuelUnits).toBeDefined();
    expect(config.safetyMargin).toBeDefined();
  });

  it('returns the flag config with doubleFlag field', () => {
    const config = getWidgetDefaultConfig('flag');
    expect(config.doubleFlag).toBe(false);
    expect(config.enabled).toBe(true);
  });

  it('returns the fuel config with storage fields', () => {
    const config = getWidgetDefaultConfig('fuel');
    expect(config.enableStorage).toBe(true);
    expect(config.enableLogging).toBe(false);
  });

  it('throws for unknown widget id', () => {
    expect(() =>
      getWidgetDefaultConfig('nonexistent' as 'standings')
    ).toThrow();
  });
});
