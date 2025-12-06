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
    vi.clearAllMocks();
    sdk = new IRacingSDK();
    // Wait for SDK to be ready
    await sdk.ready();
    // Get the mock SDK instance
    mockSdk = await getSdkOrMock();
  });

  it('should parse JSON session data correctly', () => {
    const sessionJson = JSON.stringify({
      WeekendInfo: {
        TrackName: 'test track',
        TrackID: 123,
      },
      DriverInfo: {
        Drivers: [
          {
            CarIdx: 1,
            UserName: 'test',
            AbbrevName: 'test',
            Initials: 'T',
            UserID: 12345,
          },
        ],
      },
    });

    vi.mocked(mockSdk.getSessionData).mockReturnValue(sessionJson);

    const result = sdk.getSessionData();

    expect(result).toBeDefined();
    expect(result?.WeekendInfo).toBeDefined();
    expect(result?.WeekendInfo?.TrackName).toBe('test track');
    expect(result?.DriverInfo?.Drivers[0]?.UserName).toBe('test');
  });

  it('should handle null values in JSON', () => {
    const sessionJson = JSON.stringify({
      WeekendInfo: {
        TrackName: 'test track',
        TrackID: 123,
      },
      DriverInfo: {
        Drivers: [
          {
            CarIdx: 1,
            UserName: null,
            AbbrevName: null,
            Initials: null,
            UserID: 12345,
          },
        ],
      },
    });

    vi.mocked(mockSdk.getSessionData).mockReturnValue(sessionJson);

    const result = sdk.getSessionData();

    expect(result).toBeDefined();
    expect(result?.DriverInfo?.Drivers[0]?.UserName).toBe(null);
    expect(result?.DriverInfo?.Drivers[0]?.AbbrevName).toBe(null);
    expect(result?.DriverInfo?.Drivers[0]?.Initials).toBe(null);
  });

  it('should handle special characters in names', () => {
    const sessionJson = JSON.stringify({
      WeekendInfo: {
        TrackName: 'navarra speedlong',
        TrackID: 515,
      },
      DriverInfo: {
        Drivers: [
          {
            CarIdx: 11,
            TeamName: "Mike's Team",
            UserName: "Coolio O'Brien",
          },
        ],
      },
    });

    vi.mocked(mockSdk.getSessionData).mockReturnValue(sessionJson);

    const result = sdk.getSessionData();

    expect(result).toBeDefined();
    expect(result?.DriverInfo?.Drivers[0]?.TeamName).toBe("Mike's Team");
    expect(result?.DriverInfo?.Drivers[0]?.UserName).toBe("Coolio O'Brien");
  });

  it('should cache session data based on data version', () => {
    const sessionJson = JSON.stringify({
      WeekendInfo: { TrackName: 'test track', TrackID: 123 },
    });

    vi.mocked(mockSdk.getSessionData).mockReturnValue(sessionJson);

    // First call
    const result1 = sdk.getSessionData();
    expect(result1?.WeekendInfo?.TrackName).toBe('test track');

    // Second call should use cache (getSessionData not called again)
    const result2 = sdk.getSessionData();
    expect(result2).toBe(result1);
    expect(mockSdk.getSessionData).toHaveBeenCalledTimes(1);
  });
}); 