import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SIM_WIDGET_SUPPORT,
  type FuelProjectionSnapshot,
} from '@irdashies/types';
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

  /** One-shot handlers registered by the bridge's request/response helper. */
  readonly listeners = new Set<(event: MessageEvent) => void>();

  addEventListener = vi.fn(
    (_: string, handler: (event: MessageEvent) => void) => {
      this.listeners.add(handler);
    }
  );

  removeEventListener = vi.fn(
    (_: string, handler: (event: MessageEvent) => void) => {
      this.listeners.delete(handler);
    }
  );

  /** Delivers a server message to the socket handler and the one-shot ones. */
  deliver(message: unknown): void {
    const event = { data: JSON.stringify(message) } as MessageEvent;
    this.onmessage?.(event);
    [...this.listeners].forEach((handler) => handler(event));
  }

  /** Answers the last request of `type` the way the bridge proxy would. */
  reply(type: string, data: unknown): void {
    const request = [...this.sent]
      .reverse()
      .map((message) => JSON.parse(message))
      .find((message) => message.type === type);
    this.deliver({ type, requestId: request?.requestId, data });
  }
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
  estimatedLapsRemaining: 0,
  hasValidRaceEstimate: false,
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

describe('WebSocketBridge simulator compatibility', () => {
  afterEach(() => vi.unstubAllGlobals());

  const connected = async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const bridge = new WebSocketBridge();
    const connecting = bridge.connect('http://localhost:3000');
    const socket = FakeWebSocket.latest;
    socket?.onopen?.();
    await connecting;
    return { bridge, socket: socket as FakeWebSocket };
  };

  it('reports the running simulator from the initial state', async () => {
    // Browser views never receive OverlayManager's window message, so the
    // initial state is the only thing that tells them which sim is running --
    // and without it every widget passes the compatibility filter.
    const { bridge, socket } = await connected();
    const seen = vi.fn();

    socket.deliver({ type: 'initialState', data: { simulator: 'lmu' } });
    bridge.onSimulatorChanged(seen);

    expect(seen).toHaveBeenCalledWith('lmu');
  });

  it('forwards a simulator change to its subscribers', async () => {
    const { bridge, socket } = await connected();
    const seen = vi.fn();
    const unsubscribe = bridge.onSimulatorChanged(seen);

    socket.deliver({ type: 'simulatorChanged', data: 'iracing' });
    expect(seen).toHaveBeenCalledWith('iracing');

    unsubscribe?.();
    socket.deliver({ type: 'simulatorChanged', data: 'lmu' });
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('answers the seeding requests over the socket', async () => {
    const { bridge, socket } = await connected();

    const simulator = bridge.getActiveSimulator();
    socket.reply('getActiveSimulator', 'lmu');
    await expect(simulator).resolves.toBe('lmu');

    const support = bridge.getSimWidgetSupport();
    socket.reply('getSimWidgetSupport', {
      message: 'nope',
      disabledWidgets: { iracing: [], lmu: ['input'] },
    });
    await expect(support).resolves.toEqual({
      message: 'nope',
      disabledWidgets: { iracing: [], lmu: ['input'] },
    });

    const available = bridge.getAvailableSimulators();
    socket.reply('getAvailableSimulators', ['iracing']);
    await expect(available).resolves.toEqual(['iracing']);
  });

  it('falls back rather than hanging when the socket is down', async () => {
    // A hung promise would leave the filtering permanently undecided; the
    // bundled defaults are the same thing the Electron renderer starts on.
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const bridge = new WebSocketBridge();

    await expect(bridge.getActiveSimulator()).resolves.toBeNull();
    await expect(bridge.getSimWidgetSupport()).resolves.toEqual(
      DEFAULT_SIM_WIDGET_SUPPORT
    );
    await expect(bridge.getAvailableSimulators()).resolves.toEqual([]);
  });
});
