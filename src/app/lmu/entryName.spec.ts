import { describe, expect, it } from 'vitest';
import { lmuCarNumber, lmuCarNumberRaw, lmuTeamName } from './entryName';

/**
 * Car numbers, as LMU actually publishes them.
 *
 * The values below are from a recorded ELMS grid, not invented: the mapper
 * previously handed out the slot index plus one, so a field whose real numbers
 * were 3, 7, 10, 9, 88 and 14 showed as 2, 3, 4, 5, 6, 7 -- numbers that look
 * entirely plausible and change with join order.
 */
describe('lmuCarNumber', () => {
  it('reads the number out of a real vehicle name', () => {
    expect(lmuCarNumber('DKR Engineering #3:ELMS26')).toBe('3');
    expect(lmuCarNumber('Vector Sport #7:ELMS26')).toBe('7');
    expect(lmuCarNumber('Vector Sport #10:ELMS26')).toBe('10');
    expect(lmuCarNumber('Proton Competition #9:ELMS26')).toBe('9');
    expect(lmuCarNumber('Proton Competition #88:ELMS26')).toBe('88');
    expect(lmuCarNumber('TDS Racing #14:ELMS26')).toBe('14');
    expect(lmuCarNumber('Team WRT 2026 #32:WEC')).toBe('32');
  });

  it('keeps a three-digit number whole', () => {
    // Hypercar entries run numbers like 311; a two-digit assumption would
    // quietly truncate them.
    expect(lmuCarNumber('Whelen Cadillac #311:WEC')).toBe('311');
  });

  it('keeps a letter suffix where a series uses one', () => {
    expect(lmuCarNumber('Some Team #1A:SERIES')).toBe('1A');
  });

  it('works without the series suffix', () => {
    expect(lmuCarNumber('Privateer #42')).toBe('42');
  });

  it('tolerates a space after the hash', () => {
    expect(lmuCarNumber('Privateer # 42:WEC')).toBe('42');
  });

  it('returns undefined for a name with no number', () => {
    // Two real examples from the same recording: an entry named after the car
    // alone. The caller keeps its own fallback for these.
    expect(lmuCarNumber('Ferrari 296 GT3')).toBeUndefined();
    expect(lmuCarNumber('Porsche 911 RSR')).toBeUndefined();
    expect(lmuCarNumber('')).toBeUndefined();
    expect(lmuCarNumber(undefined)).toBeUndefined();
  });

  it('does not mistake a hash in a team name for a number', () => {
    // Must start with a digit, or a stray '#' hands back prose.
    expect(lmuCarNumber('Team #1 Racing:WEC')).toBe('1');
    expect(lmuCarNumber('Team #Best:WEC')).toBeUndefined();
  });
});

describe('lmuCarNumberRaw', () => {
  it('gives the number as an integer for sorting', () => {
    expect(lmuCarNumberRaw('DKR Engineering #3:ELMS26')).toBe(3);
    expect(lmuCarNumberRaw('Proton Competition #88:ELMS26')).toBe(88);
    expect(lmuCarNumberRaw('Whelen Cadillac #311:WEC')).toBe(311);
  });

  it('declines a number that is not purely numeric', () => {
    // CarNumberRaw is a number in the shared Driver shape; '1A' has no
    // integer form that is not a lie about it.
    expect(lmuCarNumberRaw('Some Team #1A:SERIES')).toBeUndefined();
  });

  it('declines a name with no number', () => {
    expect(lmuCarNumberRaw('Ferrari 296 GT3')).toBeUndefined();
    expect(lmuCarNumberRaw(undefined)).toBeUndefined();
  });
});

describe('lmuTeamName', () => {
  it('reads the team from a real entry name', () => {
    expect(lmuTeamName('DKR Engineering #3:ELMS26')).toBe('DKR Engineering');
    expect(lmuTeamName('Vector Sport #7:ELMS26')).toBe('Vector Sport');
    expect(lmuTeamName('Proton Competition #88:ELMS26')).toBe(
      'Proton Competition'
    );
    expect(lmuTeamName('TDS Racing #14:ELMS26')).toBe('TDS Racing');
    expect(lmuTeamName('Team WRT 2026 #32:WEC')).toBe('Team WRT 2026');
  });

  it('returns undefined when there is no number to bound it', () => {
    // "Ferrari 296 GT3" is a car, not a team, and nothing in the string says
    // where a team name would end.
    expect(lmuTeamName('Ferrari 296 GT3')).toBeUndefined();
    expect(lmuTeamName('Porsche 911 RSR')).toBeUndefined();
    expect(lmuTeamName('')).toBeUndefined();
    expect(lmuTeamName(undefined)).toBeUndefined();
  });

  it('returns undefined when the name begins with the number', () => {
    // Nothing precedes the hash, so there is no team in it.
    expect(lmuTeamName('#3:ELMS26')).toBeUndefined();
    expect(lmuTeamName('   #3:ELMS26')).toBeUndefined();
  });
});
