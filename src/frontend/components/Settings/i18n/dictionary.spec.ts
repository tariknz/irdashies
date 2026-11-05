import { describe, it, expect } from 'vitest';
import {
  WIDGET_MANIFESTS,
  type PropertySpecs,
  type WidgetManifest,
} from '@irdashies/types';
import { buildDictionary, ruDictionary, ruTranslator } from './dictionary';
import { normalizeText } from './domTranslator';
import { KEEP_AS_IS } from './ru/keepAsIs';
import { pluralRu } from './ru/patterns';

describe('buildDictionary', () => {
  it('normalizes keys', () => {
    const dict = buildDictionary({ a: { '  Gap ': 'Отставание' } });
    expect(dict.get('Gap')).toBe('Отставание');
  });

  it('throws on conflicting translations', () => {
    expect(() =>
      buildDictionary({ a: { Gap: 'Отставание' }, b: { Gap: 'Разрыв' } })
    ).toThrow('i18n: conflicting translations for "Gap" in a and b');
  });

  it('does not throw on identical translations', () => {
    expect(() =>
      buildDictionary({ a: { Gap: 'Отставание' }, b: { Gap: 'Отставание' } })
    ).not.toThrow();
  });
});

describe('ruDictionary hygiene', () => {
  const entries = [...ruDictionary.entries()];

  it('has no empty values', () => {
    expect(entries.filter(([, v]) => v.trim() === '')).toEqual([]);
  });

  it('has no value equal to its key', () => {
    expect(entries.filter(([k, v]) => k === v)).toEqual([]);
  });

  it('has no emoji in values', () => {
    expect(
      entries.filter(([, v]) => /\p{Extended_Pictographic}/u.test(v))
    ).toEqual([]);
  });
});

const manifestStrings = (manifest: WidgetManifest): string[] => {
  const strings = [manifest.name, manifest.menuLabel];
  const specs: PropertySpecs = manifest.properties ?? {};
  for (const spec of Object.values(specs)) {
    if (!spec) continue;
    strings.push(spec.label, spec.description);
    if (spec.type === 'number') strings.push(spec.units);
    if (spec.type === 'enum') {
      strings.push(...spec.options.map((option) => option.label));
    }
  }
  return strings.filter((s): s is string => s !== undefined);
};

describe('widget manifest coverage', () => {
  it('every manifest string is translated or kept', () => {
    const missing = [
      ...new Set(WIDGET_MANIFESTS.flatMap(manifestStrings)),
    ].filter(
      (s) =>
        /[A-Za-z]/.test(s) &&
        ruTranslator.translateText(s) === undefined &&
        !KEEP_AS_IS.has(normalizeText(s))
    );
    expect(missing).toEqual([]);
  });
});

describe('ruPatterns', () => {
  it.each([
    ['(3 hidden)', '(скрыто: 3)'],
    ['(showing 12 hidden)', '(показаны скрытые: 12)'],
  ])('%s -> %s', (text, expected) => {
    expect(ruTranslator.translateText(text)).toBe(expected);
  });
});

describe('pluralRu', () => {
  const forms = { one: 'круг', few: 'круга', many: 'кругов' };
  it.each([
    [1, 'круг'],
    [3, 'круга'],
    [5, 'кругов'],
    [21, 'круг'],
    [22, 'круга'],
    [25, 'кругов'],
    [11, 'кругов'],
  ])('%i -> %s', (n, expected) => {
    expect(pluralRu(n, forms)).toBe(expected);
  });
});
