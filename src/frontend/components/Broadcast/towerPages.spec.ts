import { describe, expect, it } from 'vitest';
import { buildPages, pickTransition, TRANSITIONS } from './towerPages';
import { formatSpeed } from './components/TowerCards';

describe('pickTransition', () => {
  it('uses a fixed transition every time', () => {
    expect(pickTransition('flip', 'flip')).toBe('flip');
  });

  it('never repeats the last one when random', () => {
    for (let i = 0; i < 50; i++) {
      expect(pickTransition('random', 'wipe')).not.toBe('wipe');
    }
  });

  it('falls back to random for a value it does not know', () => {
    expect(TRANSITIONS).toContain(pickTransition('sparkle'));
    expect(TRANSITIONS).toContain(pickTransition(undefined));
  });
});

describe('formatSpeed', () => {
  it("follows the sim's display units", () => {
    expect(formatSpeed(160.9344, 0)).toBe('100 mph');
    expect(formatSpeed(160.9344, 1)).toBe('161 km/h');
    expect(formatSpeed(160.9344, undefined)).toBe('161 km/h');
  });
});

describe('buildPages', () => {
  const data = {
    classes: [
      ['1', 'GTP'],
      ['2', 'GTD'],
    ] as [string, string][],
    hasGained: true,
    hasPits: false,
    hasTyreChoice: true,
  };
  const kinds = (pages: ReturnType<typeof buildPages>) =>
    pages.map((p) => (p.kind === 'gaps' ? `gaps-${p.classId}` : p.kind));

  it('rotates through every page with something to show', () => {
    expect(kinds(buildPages({}, data))).toEqual([
      'names',
      'gaps-1',
      'gaps-2',
      'gained',
      'tyres',
    ]);
  });

  it('leaves out the pages the user switched off', () => {
    const pages = {
      names: false,
      gaps: true,
      gained: false,
      pits: true,
      tyres: false,
    };
    expect(kinds(buildPages({ pages }, data))).toEqual(['gaps-1', 'gaps-2']);
  });

  it('falls back to names when nothing is left', () => {
    const pages = {
      names: false,
      gaps: false,
      gained: false,
      pits: true,
      tyres: false,
    };
    expect(kinds(buildPages({ pages }, data))).toEqual(['names']);
  });

  it('keeps one page up in static mode, intervals covering every class', () => {
    expect(
      kinds(buildPages({ pageMode: 'static', staticPage: 'gaps' }, data))
    ).toEqual(['gaps-undefined']);
    expect(
      kinds(buildPages({ pageMode: 'static', staticPage: 'pits' }, data))
    ).toEqual(['pits']);
  });
});
