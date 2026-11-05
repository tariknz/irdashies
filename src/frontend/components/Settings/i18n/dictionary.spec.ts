import { describe, it, expect } from 'vitest';
import { buildDictionary, ruDictionary } from './dictionary';
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
