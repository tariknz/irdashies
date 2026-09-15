import { describe, it, expect } from 'vitest';
import { parseIbtSessionInfo } from './ibtSessionInfo';
import { IbtImportError } from './ibtErrors';

const YAML = `---
WeekendInfo:
 TrackID: 18
 TrackLength: 3.70 km
 TrackConfigName: Grand Prix
 TrackDisplayName: Test Circuit
 TrackName: testcircuit
DriverInfo:
 DriverCarIdx: 1
 Drivers:
 - CarIdx: 0
   UserName: Other Driver
   CarPath: othercar
   CarScreenName: Other Car
 - CarIdx: 1
   UserName: Test Driver
   CarPath: mycar
   CarScreenName: My Car
...
`;

describe('parseIbtSessionInfo', () => {
  it('extracts track identity, length and the player car', () => {
    const meta = parseIbtSessionInfo(YAML);
    expect(meta.trackId).toBe(18);
    expect(meta.trackConfigName).toBe('Grand Prix');
    expect(meta.trackLengthM).toBeCloseTo(3700, 3);
    // Player is DriverCarIdx 1, not the first entry in the array.
    expect(meta.carPath).toBe('mycar');
    expect(meta.driverName).toBe('Test Driver');
    expect(meta.carScreenName).toBe('My Car');
    expect(meta.trackDisplayName).toBe('Test Circuit');
  });

  it('parses a metre-denominated track length', () => {
    const meta = parseIbtSessionInfo(YAML.replace('3.70 km', '1234.5 m'));
    expect(meta.trackLengthM).toBeCloseTo(1234.5, 3);
  });

  it('throws when the session identity cannot be resolved', () => {
    const noTrack = YAML.replace('TrackID: 18', 'TrackID: 0');
    expect(() => parseIbtSessionInfo(noTrack)).toThrow(IbtImportError);
  });

  it('throws on unparseable YAML', () => {
    expect(() => parseIbtSessionInfo(':\n  : : :\n bad')).toThrow(
      IbtImportError
    );
  });
});
