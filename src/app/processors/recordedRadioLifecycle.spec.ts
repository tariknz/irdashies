import { describe, expect, it, vi } from 'vitest';
import type {
  RadioSnapshot,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import recordedTelemetry from '../../../test-data/1783998516193/telemetry.json';
import { ChannelBus } from '../bridge/channelBus';
import { connectSessionLifecycleChannel } from '../bridge/sessionLifecycleChannel';
import { createSessionLifecycle } from '../sessionLifecycle';
import { ProcessorHost } from './ProcessorHost';
import { createProcessorDefinitions } from './processorRegistry';

vi.mock('../logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// The positive radio input is recorded. Transition order below is synthetic;
// it verifies production composition, not a native SDK/simulator reconnect.
describe('recorded positive radio input across lifecycle delivery', () => {
  it('delivers positive snapshots after session change/reconnect and suppresses tape radio', () => {
    vi.useFakeTimers();
    let now = 0;
    const bus = new ChannelBus({ now: () => now });
    const lifecycle = createSessionLifecycle();
    const disconnectChannel = connectSessionLifecycleChannel(lifecycle, bus);
    const radio: RadioSnapshot[] = [];
    const events: SessionLifecycleEvent[] = [];
    let visible = true;
    const target = {
      id: 701,
      isDestroyed: () => false,
      isVisible: () => visible,
      send: (_transport: string, channel: string, payload: unknown) => {
        if (channel === 'radio.snapshot')
          radio.push(structuredClone(payload) as RadioSnapshot);
        if (channel === 'session.lifecycle')
          events.push(structuredClone(payload) as SessionLifecycleEvent);
      },
    };
    const host = new ProcessorHost({
      bus,
      lifecycle,
      metrics: { markStart: vi.fn(), markEnd: vi.fn() },
      definitions: createProcessorDefinitions({
        referenceLapPersistence: { load: () => null, save: () => undefined },
      }).filter((d) => d.channel === 'radio.snapshot'),
    });
    bus.subscribe(target, 'radio.snapshot', 60);
    bus.subscribe(target, 'session.lifecycle');
    const recorded = recordedTelemetry as unknown as Telemetry;
    expect(recorded.RadioTransmitCarIdx?.value).toEqual([2]);
    const feed = (sessionNum: number) => {
      now += 100;
      const frame = {
        ...recorded,
        SessionNum: { ...recorded.SessionNum, value: [sessionNum] },
      } as Telemetry;
      lifecycle._onTelemetry(frame);
      host.onFrame(frame);
      // Allow the production channel ceiling to deliver its coalesced tail.
      now += 100;
      vi.advanceTimersByTime(100);
    };
    try {
      lifecycle._onEnter({ replay: false });
      feed(1);
      expect(radio.at(-1)?.transmittingCarIdxs).toEqual([2]);
      feed(2);
      expect(events.at(-1)?.type).toBe('sessionNumChange');
      expect(radio.slice(-2).map((s) => s.transmittingCarIdxs)).toEqual([
        [],
        [2],
      ]);
      lifecycle._onDisconnect();
      now += 100;
      vi.advanceTimersByTime(100);
      expect(radio.at(-1)?.transmittingCarIdxs).toEqual([]);
      lifecycle._onEnter({ replay: false });
      feed(1);
      expect(radio.at(-1)?.transmittingCarIdxs).toEqual([2]);

      // Hidden snapshots stop; low-volume lifecycle facts still arrive.
      visible = false;
      bus.rendererBecameHidden(target.id);
      const before = radio.length;
      lifecycle._onDisconnect();
      lifecycle._onEnter({ replay: true });
      feed(1);
      expect(radio).toHaveLength(before);
      expect(events.slice(-2)).toEqual([
        { type: 'disconnect' },
        { type: 'enter', replay: true },
      ]);
      visible = true;
      now += 100;
      bus.rendererBecameVisible(target.id);
      feed(1);
      expect(radio.at(-1)?.transmittingCarIdxs).toEqual([]);
      lifecycle._onEnter({ replay: false });
      feed(1);
      expect(radio.at(-1)?.transmittingCarIdxs).toEqual([2]);
      expect(events).toEqual([
        { type: 'enter', replay: false },
        { type: 'sessionNumChange' },
        { type: 'disconnect' },
        { type: 'enter', replay: false },
        { type: 'disconnect' },
        { type: 'enter', replay: true },
        { type: 'enter', replay: false },
      ]);
      expect(
        bus.metricsSnapshot().channelDeliveries['radio.snapshot']
      ).toBeGreaterThan(0);
    } finally {
      host.dispose();
      disconnectChannel();
      bus.dispose();
      vi.useRealTimers();
    }
  });
});
