import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IrSdkBridge, Session, Telemetry } from '@irdashies/types';
import { ChannelBus } from '../../channelBridge';

const callbacks = vi.hoisted(() => ({
  telemetry: undefined as ((value: Telemetry) => void) | undefined,
  session: undefined as ((value: Session) => void) | undefined,
}));
const stop = vi.hoisted(() => vi.fn());

vi.mock('./generateMockData', () => ({
  generateMockData: (): IrSdkBridge => ({
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
    const overlayManager = { publishMessage: vi.fn() };
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
    } finally {
      bridge.stop();
    }
    expect(publish).toHaveBeenLastCalledWith(
      'car-speeds.snapshot',
      expect.objectContaining({ carSpeeds: [] })
    );
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
      { publishMessage: vi.fn() } as never,
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
