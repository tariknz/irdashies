import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FuelProjectionSnapshot } from '@irdashies/types';
import { WebSocketBridge } from './componentRenderer';

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static latest?: FakeWebSocket;

  readonly sent: string[] = [];
  readyState = FakeWebSocket.OPEN;
  onopen?: () => void;
  onmessage?: (event: MessageEvent) => void;
  onerror?: (event: Event) => void;
  onclose?: () => void;

  constructor(readonly url: string) {
    FakeWebSocket.latest = this;
  }

  send(message: string): void {
    this.sent.push(message);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}

const projection: FuelProjectionSnapshot = {
  isReplay: false,
  fuelLevel: 40,
  fuelLevelPct: 0.5,
  currentLap: 2,
  lapDistPct: 0.25,
  currentLapUsage: 0.5,
  projectedLapUsage: 2,
  lastLapUsage: 2.1,
  sessionLapsRemain: 10,
  sessionTimeRemain: 900,
  sessionTimeTotal: 1800,
  sessionFlags: 0,
  sessionState: 4,
  sessionNum: 0,
  sessionLaps: 12,
  calculatedTotalRaceLaps: 12,
  isFixedLapRace: true,
  sessionType: 'Race',
  isOnTrack: true,
  completedLaps: [],
  engine: {
    accumulatedRefuel: 0,
    isLapDistPctReset: false,
    lapCrossingTime: 90,
    lapStartFuel: 40.5,
    lastLap: 1,
    lastLapDistPct: 0.25,
    lastSessionFlags: 0,
    wasOnPitRoad: false,
  },
};

describe('WebSocketBridge channels', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('subscribes at the highest local rate and dispatches channel snapshots', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const bridge = new WebSocketBridge();
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = bridge.subscribe('fuel.projection', first, 5);
    const connecting = bridge.connect('http://localhost:3000');
    const socket = FakeWebSocket.latest;
    socket?.onopen?.();
    await connecting;

    const unsubscribeSecond = bridge.subscribe('fuel.projection', second, 10);
    socket?.onmessage?.({
      data: JSON.stringify({
        type: 'channel',
        data: { channel: 'fuel.projection', payload: projection },
      }),
    } as MessageEvent);

    expect(first).toHaveBeenCalledWith(projection);
    expect(second).toHaveBeenCalledWith(projection);
    expect(socket?.sent.map((message) => JSON.parse(message))).toEqual([
      {
        type: 'channelSubscribe',
        data: { channel: 'fuel.projection', requestedRateHz: 5 },
      },
      {
        type: 'channelSubscribe',
        data: { channel: 'fuel.projection', requestedRateHz: 10 },
      },
    ]);

    unsubscribeSecond();
    expect(JSON.parse(socket?.sent.at(-1) ?? '{}')).toEqual({
      type: 'channelSubscribe',
      data: { channel: 'fuel.projection', requestedRateHz: 5 },
    });
    unsubscribeFirst();
    expect(JSON.parse(socket?.sent.at(-1) ?? '{}')).toEqual({
      type: 'channelUnsubscribe',
      data: { channel: 'fuel.projection' },
    });
  });

  it('preserves the channel default when another consumer requests less', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const bridge = new WebSocketBridge();
    const unsubscribeDefault = bridge.subscribe('fuel.projection', vi.fn());
    const connecting = bridge.connect('http://localhost:3000');
    const socket = FakeWebSocket.latest;
    socket?.onopen?.();
    await connecting;
    const messagesBeforeSecondConsumer = socket?.sent.length ?? 0;
    const unsubscribeSlow = bridge.subscribe('fuel.projection', vi.fn(), 2);

    expect(socket?.sent).toHaveLength(messagesBeforeSecondConsumer + 1);
    expect(JSON.parse(socket?.sent.at(-1) ?? '{}')).toEqual({
      type: 'channelSubscribe',
      data: { channel: 'fuel.projection', requestedRateHz: 5 },
    });

    unsubscribeDefault();
    expect(JSON.parse(socket?.sent.at(-1) ?? '{}')).toEqual({
      type: 'channelSubscribe',
      data: { channel: 'fuel.projection', requestedRateHz: 2 },
    });
    unsubscribeSlow();
  });

  it('drops channel callbacks when stopped', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const bridge = new WebSocketBridge();
    const callback = vi.fn();
    bridge.subscribe('fuel.projection', callback);
    const connecting = bridge.connect('http://localhost:3000');
    const socket = FakeWebSocket.latest;
    socket?.onopen?.();
    await connecting;
    bridge.stop();

    socket?.onmessage?.({
      data: JSON.stringify({
        type: 'channel',
        data: { channel: 'fuel.projection', payload: projection },
      }),
    } as MessageEvent);

    expect(callback).not.toHaveBeenCalled();
  });

  it('subscribes to Inspector telemetry only while a consumer exists', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const bridge = new WebSocketBridge();
    const connecting = bridge.connect('http://localhost:3000');
    const socket = FakeWebSocket.latest;
    socket?.onopen?.();
    await connecting;

    expect(socket?.sent).toEqual([]);
    const unsubscribe = bridge.onTelemetry(vi.fn());
    expect(JSON.parse(socket?.sent.at(-1) ?? '{}')).toEqual({
      type: 'telemetryInspectorSubscribe',
      data: { stream: 'telemetryInspector' },
    });

    unsubscribe?.();
    expect(JSON.parse(socket?.sent.at(-1) ?? '{}')).toEqual({
      type: 'telemetryInspectorUnsubscribe',
      data: { stream: 'telemetryInspector' },
    });
  });
});
