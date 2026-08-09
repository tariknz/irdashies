import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IrSdkSourceBridge, Session, Telemetry } from '@irdashies/types';
import { ChannelBus } from '../../channelBridge';

const callbacks = vi.hoisted(() => ({
  telemetry: undefined as ((value: Telemetry) => void) | undefined,
  session: undefined as ((value: Session) => void) | undefined,
}));
const stop = vi.hoisted(() => vi.fn());

vi.mock('./generateMockData', () => ({
  generateMockData: (): IrSdkSourceBridge => ({
    onTelemetry(callback) {
      callbacks.telemetry = callback;
      return () => undefined;
    },
    onSessionData(callback) {
      callbacks.session = callback;
      return () => undefined;
    },
    onRunningState() {
      return () => undefined;
    },
    stop,
  }),
}));

vi.mock('../../../perfMetrics', () => ({
  TelemetryPerfMetrics: class {
    startReporting = vi.fn();
    stopReporting = vi.fn();
    markStart = vi.fn();
    markEnd = vi.fn();
    tick = vi.fn();
  },
}));

import { publishIRacingSDKEvents } from './mockSdkBridge';

const telemetry = (pct: number, time: number) =>
  ({
    CarIdxLapDistPct: { value: [pct] },
    SessionTime: { value: [time] },
    SessionNum: { value: [1] },
  }) as unknown as Telemetry;

describe('mockSdkBridge processor channels', () => {
  beforeEach(() => {
    callbacks.telemetry = undefined;
    callbacks.session = undefined;
    stop.mockReset();
  });

  afterEach(() => vi.restoreAllMocks());

  it('publishes subscribed Inspector telemetry at no more than 10 Hz', async () => {
    const publishMessage = vi.fn();
    const now = vi
      .spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(50)
      .mockReturnValueOnce(100);
    const bridge = await publishIRacingSDKEvents({
      publishMessage,
      hasTelemetryInspectorSubscribers: () => true,
    } as never);

    try {
      callbacks.telemetry?.(telemetry(0.1, 1));
      callbacks.telemetry?.(telemetry(0.11, 1.05));
      callbacks.telemetry?.(telemetry(0.12, 1.1));
      expect(now).toHaveBeenCalledTimes(3);
      expect(publishMessage).toHaveBeenCalledTimes(2);
      expect(publishMessage).toHaveBeenNthCalledWith(
        1,
        'telemetryInspector:telemetry',
        expect.anything()
      );
    } finally {
      bridge.stop();
    }
  });

  it('feeds mock session and telemetry through the car-speed runtime', async () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const target = {
      id: 1,
      isDestroyed: () => false,
      isVisible: () => true,
      send: vi.fn(),
    };
    bus.subscribe(target, 'car-speeds.snapshot');
    const overlayManager = {
      publishMessage: vi.fn(),
      hasTelemetryInspectorSubscribers: () => false,
    };
    const bridge = await publishIRacingSDKEvents(
      overlayManager as never,
      undefined,
      bus
    );

    try {
      callbacks.session?.({
        WeekendInfo: { TrackLength: '1 km' },
      } as Session);
      callbacks.telemetry?.(telemetry(0.1, 1));
      callbacks.telemetry?.(telemetry(0.11, 1.1));

      expect(publish).toHaveBeenCalledWith(
        'car-speeds.snapshot',
        expect.objectContaining({ carSpeeds: [360] })
      );
      expect(overlayManager.publishMessage).not.toHaveBeenCalledWith(
        'telemetryInspector:telemetry',
        expect.anything()
      );
    } finally {
      bridge.stop();
    }
    expect(publish).toHaveBeenLastCalledWith(
      'car-speeds.snapshot',
      expect.objectContaining({ carSpeeds: [] })
    );
  });

  it('feeds mock session and telemetry through the fuel runtime', async () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(
      {
        id: 4,
        isDestroyed: () => false,
        isVisible: () => true,
        send: vi.fn(),
      },
      'fuel.projection'
    );
    const bridge = await publishIRacingSDKEvents(
      {
        publishMessage: vi.fn(),
        hasTelemetryInspectorSubscribers: () => false,
      } as never,
      undefined,
      bus
    );

    try {
      callbacks.session?.({
        DriverInfo: {
          DriverCarIdx: 0,
          Drivers: [{ CarIdx: 0, CarPath: 'mock-car' }],
        },
        SessionInfo: {
          Sessions: [{ SessionNum: 1, SessionType: 'Race', SessionLaps: 20 }],
        },
      } as unknown as Session);
      callbacks.telemetry?.({
        FuelLevel: { value: [40] },
        FuelLevelPct: { value: [0.8] },
        Lap: { value: [1] },
        LapDistPct: { value: [0.1] },
        SessionTime: { value: [10] },
        SessionNum: { value: [1] },
      } as unknown as Telemetry);

      expect(publish).toHaveBeenCalledWith(
        'fuel.projection',
        expect.objectContaining({
          fuelLevel: 40,
          currentLap: 1,
          carName: 'mock-car',
        })
      );
    } finally {
      bridge.stop();
    }
  });

  it('publishes session timing without a lifecycle in demo mode', async () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(
      {
        id: 3,
        isDestroyed: () => false,
        isVisible: () => true,
        send: vi.fn(),
      },
      'session-timing.snapshot'
    );
    const bridge = await publishIRacingSDKEvents(
      {
        publishMessage: vi.fn(),
        hasTelemetryInspectorSubscribers: () => false,
      } as never,
      undefined,
      bus
    );
    try {
      callbacks.session?.({
        DriverInfo: { DriverCarIdx: 0, Drivers: [{ CarIdx: 0 }] },
        SessionInfo: {
          Sessions: [{ SessionNum: 1, SessionType: 'Race', SessionLaps: 20 }],
        },
      } as unknown as Session);
      callbacks.telemetry?.({
        SessionTime: { value: [120] },
        SessionNum: { value: [1] },
        SessionState: { value: [4] },
        SessionTimeTotal: { value: [2400] },
        SessionTimeRemain: { value: [2280] },
        CamCarIdx: { value: [0] },
        CarIdxLap: { value: [2] },
        CarIdxPosition: { value: [1] },
        CarIdxLapDistPct: { value: [0.25] },
        CarIdxBestLapTime: { value: [60] },
        CarIdxLastLapTime: { value: [60] },
      } as unknown as Telemetry);

      expect(publish).toHaveBeenCalledWith(
        'session-timing.snapshot',
        expect.objectContaining({ currentLap: 2, sessionType: 'Race' })
      );
    } finally {
      bridge.stop();
    }
  });

  it('feeds mock data through the relative-gap runtime', async () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    bus.subscribe(
      {
        id: 2,
        isDestroyed: () => false,
        isVisible: () => true,
        send: vi.fn(),
      },
      'relative-gaps.snapshot'
    );
    const bridge = await publishIRacingSDKEvents(
      {
        publishMessage: vi.fn(),
        hasTelemetryInspectorSubscribers: () => false,
      } as never,
      undefined,
      bus
    );
    try {
      callbacks.session?.({
        WeekendInfo: {
          SeriesID: 1,
          TrackID: 1,
          SubSessionID: 1,
          TrackLength: '1 km',
        },
        DriverInfo: {
          DriverCarIdx: 0,
          PaceCarIdx: -1,
          Drivers: [
            { CarIdx: 0, CarClassID: 1, CarClassEstLapTime: 100 },
            { CarIdx: 1, CarClassID: 1, CarClassEstLapTime: 100 },
          ],
        },
      } as Session);
      callbacks.telemetry?.({
        CarIdxLapDistPct: { value: [0.2, 0.25] },
        CarIdxEstTime: { value: [20, 25] },
        CarIdxLap: { value: [4, 4] },
        CarIdxOnPitRoad: { value: [false, false] },
        CamCarIdx: { value: [0] },
        SessionTime: { value: [1] },
        SessionNum: { value: [1] },
      } as unknown as Telemetry);

      expect(publish).toHaveBeenCalledWith(
        'relative-gaps.snapshot',
        expect.objectContaining({ deltas: [0, 5] })
      );
    } finally {
      bridge.stop();
    }
  });
});
