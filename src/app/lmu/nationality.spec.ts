import { describe, expect, it } from 'vitest';
import { normaliseNationality, parseTeamNationalities } from './nationality';

describe('normaliseNationality', () => {
  it('passes an alpha-2 code through, upper-cased', () => {
    expect(normaliseNationality('fr')).toBe('FR');
    expect(normaliseNationality('GB')).toBe('GB');
  });

  it('converts the alpha-3 codes LMU reports', () => {
    expect(normaliseNationality('FRA')).toBe('FR');
    expect(normaliseNationality('DEU')).toBe('DE');
    expect(normaliseNationality('USA')).toBe('US');
    expect(normaliseNationality('nzl')).toBe('NZ');
  });

  it('maps the home nations to subdivision codes', () => {
    // GB would be correct but wrong in spirit: a driver who picked Scotland
    // should get the saltire.
    expect(normaliseNationality('SCT')).toBe('GB-SCT');
    expect(normaliseNationality('ENG')).toBe('GB-ENG');
  });

  it('drops an alpha-3 it does not know rather than truncating it', () => {
    // The trap this guards: ARE is the UAE, but its first two letters are
    // Argentina. Half a code is worse than none.
    expect(normaliseNationality('ZZZ')).toBeUndefined();
    expect(normaliseNationality('ARE')).toBe('AE');
    expect(normaliseNationality('ARG')).toBe('AR');
  });

  it('ignores anything that is not a 2 or 3 letter code', () => {
    expect(normaliseNationality('')).toBeUndefined();
    expect(normaliseNationality('France')).toBeUndefined();
    expect(normaliseNationality('F1')).toBeUndefined();
    expect(normaliseNationality(42)).toBeUndefined();
    expect(normaliseNationality(null)).toBeUndefined();
    expect(normaliseNationality(undefined)).toBeUndefined();
  });

  it('tolerates surrounding whitespace', () => {
    expect(normaliseNationality('  ita ')).toBe('IT');
  });
});

describe('parseTeamNationalities', () => {
  it('reads the teams payload into a name-keyed map', () => {
    const map = parseTeamNationalities({
      drivers: {
        'Jean Dupont': { nationality: 'FRA' },
        'Max Muster': { nationality: 'DEU' },
      },
    });
    expect(map.get('Jean Dupont')).toBe('FR');
    expect(map.get('Max Muster')).toBe('DE');
    expect(map.size).toBe(2);
  });

  it('skips drivers whose nationality cannot be read', () => {
    const map = parseTeamNationalities({
      drivers: {
        Known: { nationality: 'ITA' },
        Unknown: { nationality: 'XYZ' },
        Missing: {},
        NotAnObject: 'nope',
      },
    });
    expect([...map.keys()]).toEqual(['Known']);
  });

  it('never throws on a payload it does not recognise', () => {
    // The parser contract from lmu/rest/tasks.ts: a changed payload costs one
    // missing property, not a dead poller.
    for (const payload of [
      null,
      undefined,
      42,
      'text',
      [],
      {},
      { drivers: 7 },
    ]) {
      expect(parseTeamNationalities(payload).size).toBe(0);
    }
  });
});
