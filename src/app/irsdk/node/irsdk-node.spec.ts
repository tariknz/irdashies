import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { IRacingSDK } from './irsdk-node';
import { getSdkOrMock } from './get-sdk';
import type { INativeSDK } from '../native';
import logger from '../../logger';

vi.mock('../../logger', () => ({ default: { error: vi.fn() } }));
vi.mock('js-yaml', async (importOriginal) => {
  const actual = await importOriginal<typeof yaml>();
  return { ...actual, load: vi.fn(actual.load) };
});

// Mock the getSdkOrMock module
vi.mock('./get-sdk', () => ({
  getSdkOrMock: vi.fn().mockResolvedValue({
    startSDK: vi.fn(),
    getSessionData: vi.fn(),
    currDataVersion: 0,
    enableLogging: false,
    stopSDK: vi.fn(),
    isRunning: vi.fn().mockReturnValue(true),
    waitForData: vi.fn().mockReturnValue(true),
    getTelemetryData: vi.fn().mockReturnValue({}),
    getTelemetryVariable: vi.fn(),
    broadcast: vi.fn(),
  } as INativeSDK),
}));

const sessionFixtureDirectories = [
  '1731390354633',
  '1731390745335',
  '1731391056221',
  '1731392546947',
  '1731637331038',
  '1731639076383',
  '1731639563794',
  '1731641231325',
  '1731649593423',
  '1731663455602',
  '1731663749009',
  '1731667156475',
  '1731732047131',
  '1731750041464',
  '1732260478001',
  '1732274253573',
  '1732355190142',
  '1732359661942',
  '1733030013074',
  '1735296198162',
  '1747384033336',
  '1752616787255',
  '1752616787256',
  '1762367281467',
  '1762563786057',
  '1762565848348',
  '1762847139582',
  '1763227688917',
  '1763228431951',
  '1763241199586',
  '1763752236492',
  '1767346240219',
  '1769296540072',
  '1769296545517',
  '1770713899767',
  '1770713906135',
  '1770713920383',
  '1772216560572',
  '1772788167371',
  '1781323503005',
  '1783998516193',
  'GT3 Sprint Arrays',
] as const;

describe('irsdk-node', () => {
  let sdk: IRacingSDK;
  let mockSdk: INativeSDK;

  beforeEach(async () => {
    sdk = new IRacingSDK();
    // Wait for SDK to be ready
    await sdk.ready();
    // Get the mock SDK instance
    mockSdk = await getSdkOrMock();
    vi.clearAllMocks();
    vi.mocked(mockSdk.isRunning).mockReturnValue(true);
    vi.mocked(mockSdk.waitForData).mockReturnValue(true);
    Object.defineProperty(mockSdk, 'currDataVersion', {
      value: 0,
      configurable: true,
    });
  });

  it.each(sessionFixtureDirectories)(
    'should round-trip tracked session data fixture %s',
    async (directory) => {
      const fixturePath = resolve('test-data', directory, 'session.json');
      const fixture = JSON.parse(
        await readFile(fixturePath, 'utf8')
      ) as unknown;

      vi.mocked(mockSdk.getSessionData).mockReturnValue(
        yaml.dump(fixture, { lineWidth: -1 })
      );

      expect(sdk.getSessionData()).toEqual(fixture);
    }
  );

  it('should handle malformed YAML with trailing commas', () => {
    const malformedYaml = `
WeekendInfo:
  TrackName: test track
  TrackID: 123
DriverInfo:
  Drivers:
    - CarIdx: 1
      UserName: test
      AbbrevName: test,  # Trailing comma
      Initials: T
      UserID: 12345
`;

    vi.mocked(mockSdk.getSessionData).mockReturnValue(malformedYaml);

    const result = sdk.getSessionData();

    expect(result).toBeDefined();
    expect(result?.WeekendInfo).toBeDefined();
    expect(result?.WeekendInfo?.TrackName).toBe('test track');
    expect(result?.DriverInfo?.Drivers[0]?.UserName).toBe('test');
  });

  it('should handle empty or null values', () => {
    const malformedYaml = `
WeekendInfo:
  TrackName: test track
  TrackID: 123
DriverInfo:
  Drivers:
    - CarIdx: 1
      UserName:     # Empty value
      AbbrevName:   # Empty value
      Initials:     # Empty value
      UserID: 12345
`;

    vi.mocked(mockSdk.getSessionData).mockReturnValue(malformedYaml);

    const result = sdk.getSessionData();

    expect(result).toBeDefined();
    expect(result?.DriverInfo?.Drivers[0]?.UserName).toBe(null);
    expect(result?.DriverInfo?.Drivers[0]?.AbbrevName).toBe(null);
    expect(result?.DriverInfo?.Drivers[0]?.Initials).toBe(null);
  });

  it('should handle empty value with trailing comma', () => {
    const malformedYaml = `
WeekendInfo:
  TrackName: navarra speedlong
  TrackID: 515
DriverInfo:
  Drivers:
    - CarIdx: 11
      UserName:     
      AbbrevName:  ,  
      Initials:   
      UserID: 1195427
`;

    vi.mocked(mockSdk.getSessionData).mockReturnValue(malformedYaml);

    const result = sdk.getSessionData();

    expect(result).toBeDefined();
    expect(result?.DriverInfo?.Drivers[0]?.UserName).toBe(null);
    expect(result?.DriverInfo?.Drivers[0]?.AbbrevName).toBe(null);
    expect(result?.DriverInfo?.Drivers[0]?.Initials).toBe(null);
    expect(result?.DriverInfo?.Drivers[0]?.UserID).toBe(1195427);
  });

  it('should handle values containing a literal newline (corrupted DriverSetupName)', () => {
    const malformedYaml = `
WeekendInfo:
  TrackName: nurburgring combinedlong
  TrackID: 264
DriverInfo:
  DriverCarIdx: 44
  DriverCarEstLapTime: 494.6636
  DriverSetupName: setupRoot\\folderA
folderB\\carSetupDir\\setup_name.sto
  DriverSetupIsModified: 0
  DriverSetupLoadTypeName: user
`;

    vi.mocked(mockSdk.getSessionData).mockReturnValue(malformedYaml);

    const result = sdk.getSessionData();

    expect(result).toBeDefined();
    expect(result?.WeekendInfo?.TrackName).toBe('nurburgring combinedlong');
    expect(result?.DriverInfo?.DriverSetupName).toContain('setupRoot');
    expect(result?.DriverInfo?.DriverSetupName).toContain('setup_name.sto');
    expect(result?.DriverInfo?.DriverSetupIsModified).toBe(0);
    expect(result?.DriverInfo?.DriverSetupLoadTypeName).toBe('user');
  });

  it('should handle quotes in names', () => {
    const malformedYaml = `
WeekendInfo:
  TrackName: navarra speedlong
  TrackID: 515
DriverInfo:
  Drivers:
    - CarIdx: 11
      TeamName: Mike's Team
      UserName: Coolio O'Brien
`;

    vi.mocked(mockSdk.getSessionData).mockReturnValue(malformedYaml);

    const result = sdk.getSessionData();

    expect(result).toBeDefined();
    expect(result?.DriverInfo?.Drivers[0]?.TeamName).toBe("Mike's Team");
    expect(result?.DriverInfo?.Drivers[0]?.UserName).toBe("Coolio O'Brien");
  });

  it('should handle names beginning with a YAML mapping indicator', () => {
    const malformedYaml = `
DriverInfo:
  Drivers:
    - CarIdx: 13
      UserName: ? ?
      AbbrevName:
      Initials:
`;

    vi.mocked(mockSdk.getSessionData).mockReturnValue(malformedYaml);

    const result = sdk.getSessionData();

    expect(result).toBeDefined();
    expect(result?.DriverInfo?.Drivers[0]?.UserName).toBe('? ?');
    expect(result?.DriverInfo?.Drivers[0]?.AbbrevName).toBe(null);
  });

  it('should handle the anonymous driver name from irdashies.log', () => {
    const malformedYaml = `
DriverInfo:
  Drivers:
    - CarIdx: 18
      UserName: ? ?
      AbbrevName: ?? ?
      Initials: ?
`;

    vi.mocked(mockSdk.getSessionData).mockReturnValue(malformedYaml);

    const result = sdk.getSessionData();

    expect(result).toBeDefined();
    expect(result?.DriverInfo?.Drivers[0]?.UserName).toBe('? ?');
    expect(result?.DriverInfo?.Drivers[0]?.AbbrevName).toBe('?? ?');
    expect(result?.DriverInfo?.Drivers[0]?.Initials).toBe('?');
  });

  it('should handle a team name beginning with a YAML sequence indicator', () => {
    const malformedYaml = `
DriverInfo:
  Drivers:
    - CarIdx: 1
      UserName: L M
      TeamID: 469539
      TeamName: - BLACKSUIT - Catteam Agency
      CarNumber: "1"
`;

    vi.mocked(mockSdk.getSessionData).mockReturnValue(malformedYaml);

    const result = sdk.getSessionData();

    expect(result).toBeDefined();
    expect(result?.DriverInfo?.Drivers[0]?.TeamName).toBe(
      '- BLACKSUIT - Catteam Agency'
    );
    expect(result?.DriverInfo?.Drivers[0]?.CarNumber).toBe('1');
  });

  it('should not consume the next key after a bare mapping indicator', () => {
    const malformedYaml = `
DriverInfo:
  Drivers:
    - CarIdx: 13
      UserName: ?
      AbbrevName: Anonymous
      Initials: A
`;

    vi.mocked(mockSdk.getSessionData).mockReturnValue(malformedYaml);

    const result = sdk.getSessionData();

    expect(result).toBeDefined();
    expect(result?.DriverInfo?.Drivers[0]?.UserName).toBe('?');
    expect(result?.DriverInfo?.Drivers[0]?.AbbrevName).toBe('Anonymous');
    expect(result?.DriverInfo?.Drivers[0]?.Initials).toBe('A');
  });

  it.each([
    ['TeamName', '@Example Racing'],
    ['Initials', 'Example: Name, E'],
    ['UserName', 'Bob:'],
    ['UserName', 'Bob:\tName'],
    ['TeamName', '[ABC] Racing'],
    ['TeamName', '{ABC} Racing'],
    ['UserName', '&Rapid'],
    ['UserName', '*Rapid'],
    ['UserName', '!Rapid'],
  ])(
    'should preserve unquoted %s text containing YAML syntax',
    (field, value) => {
      vi.mocked(mockSdk.getSessionData).mockReturnValue(
        `DriverInfo:\n  Drivers:\n    - CarIdx: 1\n      ${field}: ${value}\n`
      );
      expect(sdk.getSessionData()?.DriverInfo?.Drivers[0]).toEqual({
        CarIdx: 1,
        [field]: value,
      });
    }
  );

  it.each(['\n', '\r\n'])(
    'should keep YAML comments outside repaired text values with %j endings',
    (newline) => {
      const input = `DriverInfo:
  DriverSetupName: Garage\\C\u001c40_RACE.sto # setup note
  Drivers:
    - Initials: Example: Name # note
      TeamName: @Example Racing\t# team note
      UserName: Bob: # name note
      AbbrevName: ,Example # abbreviation note
    - Initials: ? # anonymous
      TeamName: - Example # indicator note
      UserName: Valid # comment: only
      AbbrevName: , # empty
    - UserName: Example#Name
      TeamName: "@Example # Racing" # quoted note
      Initials: # comment: only
`;
      vi.mocked(mockSdk.getSessionData).mockReturnValue(
        input.replace(/\n/g, newline)
      );
      expect(sdk.getSessionData()?.DriverInfo).toEqual({
        DriverSetupName: 'Garage\\C\u001c40_RACE.sto',
        Drivers: [
          {
            Initials: 'Example: Name',
            TeamName: '@Example Racing',
            UserName: 'Bob:',
            AbbrevName: ',Example',
          },
          {
            Initials: '?',
            TeamName: '- Example',
            UserName: 'Valid',
            AbbrevName: null,
          },
          {
            UserName: 'Example#Name',
            TeamName: '@Example # Racing',
            Initials: null,
          },
        ],
      });
    }
  );

  it('should preserve complete flow collections including multiline and nested values', () => {
    const input = `DriverInfo:
  Drivers:
    - Initials: [one, two] # list note
      AbbrevName: {name: "Example # Name"} # mapping note
      TeamName: [
        {name: "[Example] Racing", count: 2},
        [true, null]
        ]
      UserName: {
        TeamName: "@Example Racing",
        Initials: "Example: Name"
        }
`;
    const expected = yaml.load(input);
    vi.mocked(mockSdk.getSessionData).mockReturnValue(input);
    expect(sdk.getSessionData()).toEqual(expected);
  });

  it.each([
    'Garage\\Track\\C\u001c40_RACE.sto',
    'Garage - Example\r Team\\setup.sto',
    "Garage\\José's 日本語\\@Example: Name\u001c.sto",
    'Garage\\Unicode\u0085\u2028\u2029\u001c.sto',
  ])('should preserve setup path characters in %j', (value) => {
    vi.mocked(mockSdk.getSessionData).mockReturnValue(
      `DriverInfo:\n  DriverSetupName: ${value}\n  DriverSetupIsModified: 0\n`
    );
    expect(sdk.getSessionData()?.DriverInfo).toEqual({
      DriverSetupName: value,
      DriverSetupIsModified: 0,
    });
  });

  it.each(['\n', '\r\n'])(
    'should preserve valid scalars, quotes, paths and multiline YAML with %j endings',
    (newline) => {
      const text = String.raw`WeekendInfo:
  TrackID: 123
  TrackName: Example
  Flag: true
  Optional: null
  Empty: []
DriverInfo:
  DriverSetupName: 'Garage\Track\O''Brien.sto'
  DriverSetupLoadTypeName: user
  Drivers:
    - CarIdx: 1
      TeamName: "@Example: Racing \\ \"quoted\""
      UserName: O'Brien
      AbbrevName: 'Example: Name, E'
      Initials: "E\u001c"
      CarNumber: "001"
    - CarIdx: 2
      TeamName: "Example: , Name"
      UserName: Valid # comment: retained
      Initials: [one, two]
      AbbrevName: {name: Example}
CarSetup:
  Description: |
    real newline
    another line
  Notes: >
    folded text
    continues
`;
      const input = text.replace(/\n/g, newline);
      const expected = yaml.load(input);
      vi.mocked(mockSdk.getSessionData).mockReturnValue(input);
      expect(sdk.getSessionData()).toEqual(expected);
    }
  );

  it('should preserve mapping-like text inside block and multiline quoted scalars', () => {
    const input = `DriverInfo:
  DriverSetupName: |-
    Garage\\setup.sto
    TeamName: @Example Racing
  Drivers:
    - CarIdx: 1
      UserName: "Long name
        TeamName: @Example Racing
        end"
      AbbrevName: 'Long name
        Initials: Example: Name, E
        end'
CarSetup:
  Notes:
    - |
      TeamName: @Example Racing
      DriverSetupName: plain
      unindented path text
`;
    const expected = yaml.load(input);
    vi.mocked(mockSdk.getSessionData).mockReturnValue(input);
    expect(sdk.getSessionData()).toEqual(expected);
  });

  it('should normalize a sibling text field after a sequence-entry block scalar', () => {
    vi.mocked(mockSdk.getSessionData).mockReturnValue(`DriverInfo:
  Drivers:
    - TeamName: |
        TeamName: @Example Racing
      Initials: Example: Name, E
`);
    expect(sdk.getSessionData()?.DriverInfo?.Drivers[0]).toEqual({
      TeamName: 'TeamName: @Example Racing\n',
      Initials: 'Example: Name, E',
    });
  });

  it('should retain existing indicator and leading-comma repairs for other fields', () => {
    vi.mocked(mockSdk.getSessionData).mockReturnValue(`WeekendInfo:
  TrackName: - Example
  TrackDisplayName: ,Example
  TrackID: 123
`);
    expect(sdk.getSessionData()?.WeekendInfo).toEqual({
      TrackName: '- Example',
      TrackDisplayName: ',Example',
      TrackID: 123,
    });
  });

  describe('rejected session input', () => {
    const rejected = 'DriverInfo:\n  Drivers: [\n';
    const recovered = 'DriverInfo:\n  DriverSetupName: Garage\\setup.sto\n';

    const setVersion = (version: number) => {
      Object.defineProperty(mockSdk, 'currDataVersion', { value: version });
    };

    beforeEach(() => {
      vi.mocked(mockSdk.getSessionData).mockReturnValue(rejected);
    });

    it('should parse and log identical rejected input once while continuing native reads', () => {
      for (let poll = 0; poll < 10; poll++) {
        expect(sdk.getSessionData()).toBeNull();
      }
      expect(mockSdk.getSessionData).toHaveBeenCalledTimes(10);
      expect(yaml.load).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('should retry changed input at the same version and discard stale successful data', () => {
      vi.mocked(mockSdk.getSessionData).mockReturnValue(recovered);
      expect(sdk.getSessionData()?.DriverInfo?.DriverSetupName).toBe(
        'Garage\\setup.sto'
      );
      vi.mocked(mockSdk.getSessionData).mockReturnValue(rejected);
      expect(sdk.getSessionData()).toBeNull();
      expect(sdk.getSessionData()).toBeNull();
      vi.mocked(mockSdk.getSessionData).mockReturnValue(recovered);
      expect(sdk.getSessionData()?.DriverInfo?.DriverSetupName).toBe(
        'Garage\\setup.sto'
      );
      expect(yaml.load).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('should refresh the version through the native read before checking the cache', () => {
      vi.mocked(mockSdk.getSessionData).mockImplementation(() => {
        setVersion(5);
        return recovered;
      });
      const first = sdk.getSessionData();
      expect(sdk.currDataVersion).toBe(5);
      expect(sdk.getSessionData()).toBe(first);
      expect(mockSdk.getSessionData).toHaveBeenCalledTimes(2);
      expect(yaml.load).toHaveBeenCalledTimes(1);
    });

    it('should retain only the latest rejected input', () => {
      expect(sdk.getSessionData()).toBeNull();
      vi.mocked(mockSdk.getSessionData).mockReturnValue('WeekendInfo: [\n');
      expect(sdk.getSessionData()).toBeNull();
      vi.mocked(mockSdk.getSessionData).mockReturnValue(rejected);
      expect(sdk.getSessionData()).toBeNull();
      expect(yaml.load).toHaveBeenCalledTimes(3);
    });

    it('should skip identical rejected input across increasing versions and retry on rewind', () => {
      expect(sdk.getSessionData()).toBeNull();
      setVersion(1);
      expect(sdk.getSessionData()).toBeNull();
      setVersion(2);
      expect(sdk.getSessionData()).toBeNull();
      expect(yaml.load).toHaveBeenCalledTimes(1);
      setVersion(1);
      expect(sdk.getSessionData()).toBeNull();
      expect(yaml.load).toHaveBeenCalledTimes(2);
    });

    it('should still reject malformed structure outside the known text fields', () => {
      vi.mocked(mockSdk.getSessionData).mockReturnValue(
        'WeekendInfo:\n  TrackID: bad: value\n'
      );
      expect(sdk.getSessionData()).toBeNull();
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('should recover after a native read throws without returning stale data', () => {
      vi.mocked(mockSdk.getSessionData).mockReturnValue(recovered);
      sdk.getSessionData();
      vi.mocked(mockSdk.getSessionData).mockImplementationOnce(() => {
        throw new Error('PrivateDriver\\setup.sto');
      });
      expect(sdk.getSessionData()).toBeNull();
      expect(sdk.getSessionData()?.DriverInfo?.DriverSetupName).toBe(
        'Garage\\setup.sto'
      );
      expect(yaml.load).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(
        'There was an error getting session data:',
        { reason: 'session data read failed' }
      );
    });

    it.each([
      'stop',
      'start',
      'disconnect',
      'native reset',
      'version rollback',
      'seek',
      'empty',
    ])('should clear rejected and successful input on %s', (reset) => {
      const resetCache = () => {
        switch (reset) {
          case 'stop':
            sdk.stopSDK();
            break;
          case 'start':
            vi.mocked(mockSdk.isRunning).mockReturnValueOnce(false);
            sdk.startSDK();
            break;
          case 'disconnect':
            vi.mocked(mockSdk.isRunning).mockReturnValueOnce(false);
            expect(sdk.sessionStatusOK).toBe(false);
            break;
          case 'native reset':
            setVersion(-1);
            sdk.waitForData();
            setVersion(5);
            break;
          case 'version rollback':
            setVersion(0);
            break;
          case 'seek':
            mockSdk.seekTapeReplay = vi.fn().mockReturnValue(true);
            mockSdk.getTapeReplayStatus = vi.fn().mockReturnValue({
              position: 0,
              duration: 60,
              speed: 1,
              paused: true,
              ended: false,
            });
            sdk.controlTapeReplay({ type: 'seek', seconds: 0 });
            break;
          case 'empty':
            vi.mocked(mockSdk.getSessionData).mockReturnValueOnce('');
            expect(sdk.getSessionData()).toBeNull();
            break;
        }
      };

      for (const input of [rejected, recovered]) {
        setVersion(5);
        vi.mocked(mockSdk.getSessionData).mockReturnValue(input);
        sdk.getSessionData();
        resetCache();
        vi.mocked(yaml.load).mockClear();
        sdk.getSessionData();
        expect(yaml.load).toHaveBeenCalledTimes(1);
      }
    });

    it('should preserve the rejection cache on an ordinary poll timeout', () => {
      expect(sdk.getSessionData()).toBeNull();
      vi.mocked(mockSdk.waitForData).mockReturnValue(false);
      sdk.waitForData();
      expect(sdk.getSessionData()).toBeNull();
      expect(yaml.load).toHaveBeenCalledTimes(1);
    });

    it('should log safe context without raw session text, exception buffers or paths', () => {
      vi.mocked(mockSdk.getSessionData).mockReturnValue(
        'DriverInfo:\n  DriverSetupName: "Garage\\PrivateDriver\\secret.sto"\n'
      );
      expect(sdk.getSessionData()).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'There was an error getting session data:',
        {
          reason: 'invalid YAML',
          field: 'DriverSetupName',
          line: 2,
          column: expect.any(Number),
        }
      );
      expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toMatch(
        /PrivateDriver|secret|buffer|snippet|stack/
      );
    });

    it('should not include user-controlled error reasons or unknown field names', () => {
      vi.mocked(mockSdk.getSessionData).mockReturnValue(
        'PrivateDriver: !secret value\n'
      );
      expect(sdk.getSessionData()).toBeNull();
      expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toMatch(
        /PrivateDriver|secret|value/
      );
    });
  });
});
