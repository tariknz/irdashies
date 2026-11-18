import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GlobalFlags,
  SessionState,
  type Session,
  type Telemetry,
} from '@irdashies/types';
import recordedTelemetry from '../../../irsdk/node/utils/mock-data/telemetry.json';
import recordedSession from '../../../irsdk/node/utils/mock-data/session.json';
import { generateMockData } from './generateMockData';

describe('generateMockData', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('supplies the same active race fields to every demo consumer without changing the recording', () => {
    const bridge = generateMockData();
    const frames: Telemetry[] = [];
    const originalState = recordedTelemetry.SessionState.value[0];
    bridge.onTelemetry((frame) => frames.push(frame));
    vi.advanceTimersByTime(100);
    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) {
      expect(frame.SessionState.value[0]).toBe(SessionState.Racing);
      expect(frame.SessionFlags.value[0]).toBe(GlobalFlags.Green);
      expect(frame.SessionLapsRemainEx.value).toEqual(
        frame.SessionLapsRemain.value
      );
    }
    expect(recordedTelemetry.SessionState.value[0]).toBe(originalState);
    bridge.stop();
  });

  it('moves the raw pedals with the processed ones, as a car without assists would', () => {
    const bridge = generateMockData();
    const frames: Telemetry[] = [];
    bridge.onTelemetry((frame) => frames.push(frame));
    vi.advanceTimersByTime(1000);
    const value = (frame: Telemetry, key: keyof Telemetry) =>
      (frame[key] as { value: number[] }).value[0];
    for (const frame of frames) {
      expect(value(frame, 'ThrottleRaw')).toBe(value(frame, 'Throttle'));
      expect(value(frame, 'BrakeRaw')).toBe(value(frame, 'Brake'));
      expect(value(frame, 'ClutchRaw')).toBe(value(frame, 'Clutch'));
    }
    // Moving, not stuck at the recording's 0.
    const brakes = new Set(frames.map((frame) => value(frame, 'BrakeRaw')));
    expect(brakes.size).toBeGreaterThan(1);
    bridge.stop();
  });

  it('preserves explicit recording state instead of applying demo defaults', () => {
    const telemetry = structuredClone(
      recordedTelemetry
    ) as unknown as Telemetry;
    telemetry.SessionState.value[0] = SessionState.Checkered;
    const bridge = generateMockData({
      telemetry,
      sessionInfo: recordedSession as unknown as Session,
    });
    const receive = vi.fn();
    bridge.onTelemetry(receive);
    vi.advanceTimersByTime(100);
    expect(receive).toHaveBeenCalled();
    expect(receive.mock.calls[0][0].SessionState.value[0]).toBe(
      SessionState.Checkered
    );
    bridge.stop();
  });

  it('resumes telemetry for subscribers added after stop()', () => {
    // Regression: stop() cleared the intervals but left the handles truthy,
    // so the "start the interval only once" guards blocked any restart — a
    // stop()ed instance delivered nothing to later subscribers, silently.
    const bridge = generateMockData();

    const before = vi.fn();
    bridge.onTelemetry(before);
    vi.advanceTimersByTime(100);
    expect(before).toHaveBeenCalled();

    bridge.stop();

    const after = vi.fn();
    bridge.onTelemetry(after);
    vi.advanceTimersByTime(100);
    expect(after).toHaveBeenCalled();

    bridge.stop();
  });

  it('emits a team racing session with distinct team names for the running mock app', () => {
    const bridge = generateMockData();
    const onSession = vi.fn();

    bridge.onSessionData(onSession);

    const session = onSession.mock.calls[0][0] as Session;
    const drivers = session.DriverInfo.Drivers.filter(
      (driver) => !driver.CarIsPaceCar
    );
    expect(session.WeekendInfo.TeamRacing).toBe(1);
    expect(drivers.every((driver) => driver.TeamID > 0)).toBe(true);
    expect(drivers.every((driver) => driver.TeamName !== driver.UserName)).toBe(
      true
    );
    expect(
      new Set(drivers.map((driver) => driver.TeamName)).size
    ).toBeGreaterThan(1);

    bridge.stop();
  });
});
