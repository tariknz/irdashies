import { describe, it, expect, beforeEach, vi } from 'vitest';
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
