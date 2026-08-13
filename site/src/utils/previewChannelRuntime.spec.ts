import { describe, expect, it } from 'vitest';
import type {
  DriverControlsSnapshot,
  IrSdkSourceBridge,
  Session,
  Telemetry,
} from '@irdashies/types';
import { createPreviewChannelRuntime } from './previewChannelRuntime';
import mockTelemetry from '../../../src/app/irsdk/node/utils/mock-data/telemetry.json';
import mockSession from '../../../src/app/irsdk/node/utils/mock-data/session.json';

/**
 * The site has no Electron main process, so these assert that the real
 * ChannelBus + processors actually run in-page and feed widgets. The bug this
 * guards: widgets migrated to channels while the site still had no
 * `window.channelBridge`, so every preview widget threw on mount.
 */

/**
 * Processors return a single mutated snapshot object rather than a fresh one
 * per tick, so assertions must capture scalar values at delivery time — a
 * retained reference reflects whatever the processor holds now, not what was
 * delivered. `ChannelBus` also throttles to the channel rate, so frames need
 * real time between them to produce separate deliveries.
 */
const DELIVERY_INTERVAL_MS = 60; // driver-controls.snapshot defaults to 25Hz

const flushDeliveries = () =>
  new Promise((resolve) => setTimeout(resolve, DELIVERY_INTERVAL_MS));

const setValue = (frame: Telemetry, key: string, value: number): void => {
  (frame as unknown as Record<string, { value: number[] }>)[key].value[0] =
    value;
};

/** Fresh frame with a distinct throttle and an advancing session clock. */
const frameAt = (sessionTime: number, throttle: number): Telemetry => {
  const frame = structuredClone(mockTelemetry) as unknown as Telemetry;
  setValue(frame, 'SessionTime', sessionTime);
  setValue(frame, 'Throttle', throttle);
  return frame;
};

const createFakeSource = () => {
  const telemetryCallbacks = new Set<(value: Telemetry) => void>();
  const sessionCallbacks = new Set<(value: Session) => void>();

  const source: IrSdkSourceBridge = {
    onTelemetry: (callback) => {
      telemetryCallbacks.add(callback);
      return () => telemetryCallbacks.delete(callback);
    },
    onSessionData: (callback) => {
      sessionCallbacks.add(callback);
      return () => sessionCallbacks.delete(callback);
    },
    onRunningState: () => () => undefined,
    stop: () => undefined,
  };

  return {
    source,
    emitSession: (session: Session) =>
      sessionCallbacks.forEach((cb) => cb(session)),
    emitFrame: (frame: Telemetry) =>
      telemetryCallbacks.forEach((cb) => cb(frame)),
    telemetrySubscriberCount: () => telemetryCallbacks.size,
    sessionSubscriberCount: () => sessionCallbacks.size,
  };
};

describe('createPreviewChannelRuntime', () => {
  it('runs the real processors in-page and delivers derived snapshots', async () => {
    const fake = createFakeSource();
    const runtime = createPreviewChannelRuntime(fake.source);
    const throttles: (number | undefined)[] = [];

    const unsubscribe = runtime.bridge.subscribe(
      'driver-controls.snapshot',
      (payload: DriverControlsSnapshot) => throttles.push(payload.throttle)
    );

    fake.emitSession(mockSession as unknown as Session);
    fake.emitFrame(frameAt(100, 0.25));
    await flushDeliveries();

    expect(throttles).toContain(0.25);

    unsubscribe();
    runtime.dispose();
  });

  it('keeps delivering as telemetry changes, so the preview animates', async () => {
    const fake = createFakeSource();
    const runtime = createPreviewChannelRuntime(fake.source);
    const throttles: (number | undefined)[] = [];

    const unsubscribe = runtime.bridge.subscribe(
      'driver-controls.snapshot',
      (payload: DriverControlsSnapshot) => throttles.push(payload.throttle)
    );

    fake.emitSession(mockSession as unknown as Session);
    // Session time has to advance past the processor's tick interval for the
    // frame to count as due, and wall-clock time has to advance past the
    // channel's delivery interval for each snapshot to reach the consumer.
    fake.emitFrame(frameAt(100, 0.2));
    await flushDeliveries();
    fake.emitFrame(frameAt(101, 0.6));
    await flushDeliveries();
    fake.emitFrame(frameAt(102, 1));
    await flushDeliveries();

    expect(throttles).toContain(0.2);
    expect(throttles).toContain(0.6);
    expect(throttles).toContain(1);

    unsubscribe();
    runtime.dispose();
  });

  it('stops delivering once the last consumer unsubscribes', async () => {
    const fake = createFakeSource();
    const runtime = createPreviewChannelRuntime(fake.source);
    const throttles: (number | undefined)[] = [];

    const unsubscribe = runtime.bridge.subscribe(
      'driver-controls.snapshot',
      (payload: DriverControlsSnapshot) => throttles.push(payload.throttle)
    );
    fake.emitSession(mockSession as unknown as Session);
    fake.emitFrame(frameAt(100, 0.25));
    await flushDeliveries();
    const deliveredWhileSubscribed = throttles.length;

    unsubscribe();
    fake.emitFrame(frameAt(101, 0.75));
    await flushDeliveries();

    expect(deliveredWhileSubscribed).toBeGreaterThan(0);
    expect(throttles).not.toContain(0.75);
    expect(throttles.length).toBe(deliveredWhileSubscribed);

    runtime.dispose();
  });

  it('releases its telemetry and session subscriptions on dispose', () => {
    const fake = createFakeSource();
    const runtime = createPreviewChannelRuntime(fake.source);

    expect(fake.telemetrySubscriberCount()).toBe(1);
    expect(fake.sessionSubscriberCount()).toBe(1);

    runtime.dispose();

    expect(fake.telemetrySubscriberCount()).toBe(0);
    expect(fake.sessionSubscriberCount()).toBe(0);
  });
});
