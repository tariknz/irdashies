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

describe('mockSdkBridge car-speed channel', () => {
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

    callbacks.session?.({
      WeekendInfo: { TrackLength: '1 km' },
    } as Session);
    callbacks.telemetry?.(telemetry(0.1, 1));
    callbacks.telemetry?.(telemetry(0.11, 1.1));

    expect(publish).toHaveBeenCalledWith(
      'car-speeds.snapshot',
      expect.objectContaining({ carSpeeds: [360] })
    );
    bridge.stop();
    expect(publish).toHaveBeenLastCalledWith(
      'car-speeds.snapshot',
      expect.objectContaining({ carSpeeds: [] })
    );
  });
});
