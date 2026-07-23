import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { IRacingSDK } from './irsdk-node';
import { getSdkOrMock } from './get-sdk';
import type { INativeSDK } from '../native';

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
});
