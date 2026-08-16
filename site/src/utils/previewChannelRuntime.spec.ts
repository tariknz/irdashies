import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DriverControlsSnapshot,
  IrSdkSourceBridge,
  Session,
  Telemetry,
} from '@irdashies/types';
import {
  createPreviewChannelRuntime,
  shieldSourceFromStop,
} from './previewChannelRuntime';
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
 * delivered. `ChannelBus` also throttles to the channel rate, so simulated
 * time must advance between frames to produce separate deliveries.
 */
const DELIVERY_INTERVAL_MS = 60; // driver-controls.snapshot defaults to 25Hz

const flushDeliveries = () => vi.advanceTimersByTimeAsync(DELIVERY_INTERVAL_MS);

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
    // Broadcast commands added for the Gantry's race-control features; the
    // preview never drives the replay, so they are inert here.
    changeCameraNumber: () => undefined,
    changeReplayPosition: () => undefined,
    triggerReplaySessionSearch: () => undefined,
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
    /** Mirrors generateMockData's stop(), which drops every subscriber. */
    wipeAllSubscribers: () => {
      telemetryCallbacks.clear();
      sessionCallbacks.clear();
    },
  };
};

describe('createPreviewChannelRuntime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('delivers even while the document reports hidden', async () => {
    // Regression: gating the renderer target on `document.visibilityState`
    // meant a subscription created while hidden never fired
    // notifySubscriberCount, so ProcessorHost never activated the processor
    // and the preview stayed empty forever. Documents can report hidden while
    // still painting (occluded tab, automation), so delivery must not depend
    // on it.
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden');

    try {
      const fake = createFakeSource();
      const runtime = createPreviewChannelRuntime(fake.source);
      const throttles: (number | undefined)[] = [];

      const unsubscribe = runtime.bridge.subscribe(
        'driver-controls.snapshot',
        (payload: DriverControlsSnapshot) => throttles.push(payload.throttle)
      );

      fake.emitSession(mockSession as unknown as Session);
      fake.emitFrame(frameAt(100, 0.42));
      await flushDeliveries();

      expect(throttles).toContain(0.42);

      unsubscribe();
      runtime.dispose();
    } finally {
      visibility.mockRestore();
    }
  });

  it('delivers each snapshot as a fresh object, never the live processor state', async () => {
    // Regression: processors publish `this.latest` — one object mutated in
    // place each tick. In the real app Electron IPC structured-clones every
    // delivery, and the frontend's change detection (Object.is in channel
    // selections, useSyncExternalStore, useMemo deps on snapshot arrays)
    // depends on that fresh identity. Delivering the live object instead made
    // every delivery reference-equal to the first, so widgets mounted at page
    // load froze on the processor's empty initial snapshot until remounted.
    const fake = createFakeSource();
    const runtime = createPreviewChannelRuntime(fake.source);
    const payloads: DriverControlsSnapshot[] = [];

    const unsubscribe = runtime.bridge.subscribe(
      'driver-controls.snapshot',
      (payload: DriverControlsSnapshot) => payloads.push(payload)
    );

    fake.emitSession(mockSession as unknown as Session);
    fake.emitFrame(frameAt(100, 0.2));
    await flushDeliveries();
    fake.emitFrame(frameAt(101, 0.6));
    await flushDeliveries();

    expect(payloads.length).toBeGreaterThanOrEqual(2);
    // Distinct identity per delivery — the property all change detection needs.
    expect(payloads[0]).not.toBe(payloads[1]);
    // Earlier snapshots must not be retroactively mutated by later processor
    // ticks. Without the clone every entry here is the same live object, so
    // at assert time they would all read the final throttle and no payload
    // holding the earlier value could exist.
    expect(payloads.some((p) => p.throttle === 0.2)).toBe(true);
    expect(payloads.some((p) => p.throttle === 0.6)).toBe(true);

    unsubscribe();
    runtime.dispose();
  });

  it('survives a consumer calling stop() on the shared source', async () => {
    // Regression: generateMockData's stop() clears every callback and clears
    // its interval handles without nulling them, so its "start only once"
    // guards block any restart — one stop() kills telemetry permanently.
    // RunningStateProvider calls stop() on unmount and StrictMode unmounts
    // once on mount, so the preview lost telemetry before it ever rendered.
    const fake = createFakeSource();
    let stopCalls = 0;
    const destructiveSource: IrSdkSourceBridge = {
      ...fake.source,
      stop: () => {
        stopCalls += 1;
        fake.wipeAllSubscribers();
      },
    };

    const runtime = createPreviewChannelRuntime(
      shieldSourceFromStop(destructiveSource)
    );
    const throttles: (number | undefined)[] = [];
    const unsubscribe = runtime.bridge.subscribe(
      'driver-controls.snapshot',
      (payload: DriverControlsSnapshot) => throttles.push(payload.throttle)
    );

    // What RunningStateProvider does on unmount.
    shieldSourceFromStop(destructiveSource).stop();

    fake.emitSession(mockSession as unknown as Session);
    fake.emitFrame(frameAt(100, 0.33));
    await flushDeliveries();

    expect(stopCalls).toBe(0);
    expect(fake.telemetrySubscriberCount()).toBe(1);
    expect(throttles).toContain(0.33);

    unsubscribe();
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
