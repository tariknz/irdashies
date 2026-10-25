import { EventEmitter } from 'node:events';
import { Server } from 'node:http';
import { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DashboardBridge,
  DashboardLayout,
  IrSdkSourceBridge,
  PitLaneBridge,
  Session,
  Telemetry,
} from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBus';
import logger from '../logger';
import { createBridgeProxy } from './bridgeProxy';

// Exercise the real proxy handlers synchronously, without network timing.
vi.mock('ws', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ws')>();
  const { EventEmitter } = await import('node:events');
  return { ...actual, WebSocketServer: class extends EventEmitter {} };
});

vi.mock('../bridge/iracingSdk/setup', () => ({
  getActiveSimulator: () => 'iracing',
  getIsDemoMode: () => false,
  onActiveSimulatorChanged: vi.fn(),
}));
vi.mock('../bridge/iracingSdk/sims/registry', () => ({
  getAvailableSimulators: () => ['iracing'],
}));
vi.mock('../storage/simWidgetSupport', () => ({
  loadSimWidgetSupport: vi.fn(),
}));
vi.mock('../widgetVisibility', () => ({
  getHiddenWidgets: () => [],
  onWidgetHiddenChanged: vi.fn(),
}));
vi.mock('../logger', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

class Client extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  send = vi.fn<(message: string) => void>();

  request(type: string, stream: unknown) {
    this.emit(
      'message',
      Buffer.from(JSON.stringify({ type, data: { stream } }))
    );
  }

  messages(type: string) {
    return this.send.mock.calls
      .map(
        ([message]) => JSON.parse(message) as { type: string; data: unknown }
      )
      .filter((message) => message.type === type);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
  }
}

function makeSource() {
  const events = new EventEmitter();
  const bridge = {
    onTelemetry: vi.fn((callback: (value: Telemetry) => void) => {
      events.on('telemetry', callback);
      return vi.fn(() => events.off('telemetry', callback));
    }),
    onSessionData: vi.fn((callback: (value: Session) => void) => {
      events.on('session', callback);
      return vi.fn(() => events.off('session', callback));
    }),
    onRunningState: vi.fn((callback: (value: boolean) => void) => {
      events.on('running', callback);
      return vi.fn(() => events.off('running', callback));
    }),
    stop: vi.fn(),
    changeCameraNumber: vi.fn(),
    changeReplayPosition: vi.fn(),
    triggerReplaySessionSearch: vi.fn(),
  } satisfies IrSdkSourceBridge;
  return {
    bridge,
    telemetry: (value: Telemetry) => events.emit('telemetry', value),
    session: (value: Session) => events.emit('session', value),
    running: (value: boolean) => events.emit('running', value),
  };
}

const telemetry = (speed: number) =>
  ({ Speed: { value: [speed] } }) as Telemetry;
const session = (name: string) =>
  ({ WeekendInfo: { TrackName: name } }) as Session;

function setup(dashboardBridge?: DashboardBridge, bus?: ChannelBus) {
  const source = makeSource();
  const proxy = createBridgeProxy(
    new Server(),
    source.bridge,
    dashboardBridge,
    bus
  );
  const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
  const stringify = vi.spyOn(JSON, 'stringify');
  return {
    source,
    proxy,
    clock,
    connect: () => {
      const client = new Client();
      proxy.wss.emit('connection', client);
      return client;
    },
    // Count actual JSON.stringify calls for full Inspector envelopes, including
    // immediate cached deliveries. Suppressing socket.send alone cannot pass.
    serializations: (type: string) =>
      stringify.mock.calls.filter(
        ([value]) => (value as { type?: unknown } | undefined)?.type === type
      ).length,
  };
}

const streams = [
  { stream: 'telemetryInspector', type: 'telemetry' },
  { stream: 'sessionData', type: 'sessionData' },
] as const;

describe('browser Inspector serialization demand', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('counts full telemetry serializations for identical 60 Hz sequences without and with Inspector demand', () => {
    const { source, connect, clock, serializations } = setup();
    connect(); // Ordinary browser/OBS widget client remains connected throughout.
    const inspector = connect();
    const frame = telemetry(42);
    const emitSecond = (start: number) => {
      for (let i = 0; i < 60; i++) {
        clock.mockReturnValue(start + Math.floor((i * 1000) / 60));
        source.telemetry(frame);
      }
    };

    emitSecond(0);
    const withoutInspector = serializations('telemetry');
    inspector.request('telemetryInspectorSubscribe', 'telemetryInspector');
    const immediateSubscribe = serializations('telemetry') - withoutInspector;
    emitSecond(1000);
    const subscribedFrames =
      serializations('telemetry') - withoutInspector - immediateSubscribe;

    expect({ withoutInspector, immediateSubscribe, subscribedFrames }).toEqual({
      withoutInspector: 0,
      immediateSubscribe: 1,
      subscribedFrames: 10,
    });
    expect(inspector.messages('telemetry')).toHaveLength(11);
  });

  it('preserves the broadcast cadence when an Inspector subscribes between ticks', () => {
    const { source, connect, clock, serializations } = setup();
    const inspector = connect();
    source.telemetry(telemetry(10));
    expect(serializations('telemetry')).toBe(0);

    clock.mockReturnValue(50);
    inspector.request('telemetryInspectorSubscribe', 'telemetryInspector');
    expect(inspector.messages('telemetry')).toEqual([
      { type: 'telemetry', data: telemetry(10) },
    ]);

    clock.mockReturnValue(99);
    source.telemetry(telemetry(20));
    expect(serializations('telemetry')).toBe(1);

    clock.mockReturnValue(100);
    source.telemetry(telemetry(30));
    expect(serializations('telemetry')).toBe(2);
    expect(inspector.messages('telemetry').map(({ data }) => data)).toEqual([
      telemetry(10),
      telemetry(30),
    ]);
  });

  it('keeps the latest telemetry even inside the 100 ms broadcast interval', () => {
    const { source, connect, clock, serializations } = setup();
    const first = connect();
    first.request('telemetryInspectorSubscribe', 'telemetryInspector');
    source.telemetry(telemetry(10));
    clock.mockReturnValue(99);
    source.telemetry(telemetry(20));
    expect(serializations('telemetry')).toBe(1);

    const second = connect();
    second.request('telemetryInspectorSubscribe', 'telemetryInspector');
    expect(second.messages('telemetry')).toEqual([
      { type: 'telemetry', data: telemetry(20) },
    ]);
    clock.mockReturnValue(100);
    source.telemetry(telemetry(30));
    expect(serializations('telemetry')).toBe(3);
    expect(first.messages('telemetry').map(({ data }) => data)).toEqual([
      telemetry(10),
      telemetry(30),
    ]);
  });

  it.each(streams)(
    'gates $type independently and delivers the latest cached data immediately',
    ({ stream, type }) => {
      const { source, connect, serializations } = setup();
      const ordinary = connect();
      const inspector = connect();
      const other = connect();
      const otherType = type === 'telemetry' ? 'sessionData' : 'telemetry';
      other.request(
        'telemetryInspectorSubscribe',
        stream === 'telemetryInspector' ? 'sessionData' : 'telemetryInspector'
      );
      source.telemetry(telemetry(10));
      source.session(session('old'));
      source.telemetry(telemetry(20));
      source.session(session('latest'));
      expect(serializations(type)).toBe(0);
      const otherCount = serializations(otherType);

      inspector.request('telemetryInspectorSubscribe', stream);
      const expected = type === 'telemetry' ? telemetry(20) : session('latest');
      expect(serializations(type)).toBe(1);
      expect(inspector.messages(type)).toEqual([{ type, data: expected }]);
      expect(serializations(otherType)).toBe(otherCount);
      expect(ordinary.messages(type)).toEqual([]);
      expect(other.messages(type)).toEqual([]);
    }
  );

  it.each(streams)(
    'serializes $type once for multiple subscribers and stops after the last unsubscribe or close',
    ({ stream, type }) => {
      const { source, connect, clock, serializations } = setup();
      connect(); // Keep an ordinary widget client alive after Inspector closes.
      const first = connect();
      const second = connect();
      first.request('telemetryInspectorSubscribe', stream);
      first.request('telemetryInspectorSubscribe', stream); // Set membership is idempotent.
      second.request('telemetryInspectorSubscribe', stream);
      const emit = (time: number) => {
        clock.mockReturnValue(time);
        source.telemetry(telemetry(time));
        source.session(session(String(time)));
      };
      emit(0);
      expect(serializations(type)).toBe(1);
      expect(first.messages(type)).toHaveLength(1);
      expect(second.messages(type)).toEqual(first.messages(type));

      first.request('telemetryInspectorUnsubscribe', stream);
      emit(100);
      expect(serializations(type)).toBe(2);
      expect(first.messages(type)).toHaveLength(1);
      expect(second.messages(type)).toHaveLength(2);

      second.request('telemetryInspectorUnsubscribe', stream);
      emit(200);
      expect(serializations(type)).toBe(2);
      second.request('telemetryInspectorSubscribe', stream);
      expect(serializations(type)).toBe(3); // Latest data from the demand-free interval.
      expect(second.messages(type).at(-1)?.data).toEqual(
        type === 'telemetry' ? telemetry(200) : session('200')
      );
      first.request('telemetryInspectorSubscribe', stream);
      expect(serializations(type)).toBe(4);
      second.close();
      emit(300);
      expect(serializations(type)).toBe(5); // First subscriber still needs updates.
      first.close();
      emit(400);
      expect(serializations(type)).toBe(5);
    }
  );

  it.each([WebSocket.CONNECTING, WebSocket.CLOSING, WebSocket.CLOSED])(
    'ignores subscribed sockets in non-OPEN state %s before their close event',
    (state) => {
      const { source, connect, serializations } = setup();
      connect();
      const inspector = connect();
      inspector.request('telemetryInspectorSubscribe', 'telemetryInspector');
      inspector.request('telemetryInspectorSubscribe', 'sessionData');
      inspector.readyState = state;
      source.telemetry(telemetry(10));
      source.session(session('latest'));
      // A subscribe message already queued when the socket stopped being OPEN
      // must not serialize the cached payload either.
      inspector.request('telemetryInspectorSubscribe', 'telemetryInspector');
      inspector.request('telemetryInspectorSubscribe', 'sessionData');
      expect(serializations('telemetry')).toBe(0);
      expect(serializations('sessionData')).toBe(0);
      expect(inspector.messages('telemetry')).toEqual([]);
      expect(inspector.messages('sessionData')).toEqual([]);
    }
  );

  it('rejects invalid stream subscriptions and unsubscriptions without changing demand', () => {
    const { source, connect, clock, serializations } = setup();
    const inspector = connect();
    for (const stream of [
      undefined,
      null,
      'telemetry',
      'runningState',
      {},
      1,
    ]) {
      inspector.request('telemetryInspectorSubscribe', stream);
    }
    source.telemetry(telemetry(10));
    source.session(session('latest'));
    expect(serializations('telemetry')).toBe(0);
    expect(serializations('sessionData')).toBe(0);
    expect(logger.error).toHaveBeenCalledTimes(6);

    inspector.request('telemetryInspectorSubscribe', 'telemetryInspector');
    inspector.request('telemetryInspectorUnsubscribe', 'telemetry');
    clock.mockReturnValue(100);
    source.telemetry(telemetry(20));
    expect(serializations('telemetry')).toBe(2);
    expect(logger.error).toHaveBeenCalledTimes(7);
  });

  it('preserves subscriptions across source changes and requires new sockets to subscribe after reconnect', () => {
    const { source, proxy, connect, clock, serializations } = setup();
    const inspector = connect();
    inspector.request('telemetryInspectorSubscribe', 'telemetryInspector');
    inspector.request('telemetryInspectorSubscribe', 'sessionData');
    source.telemetry(telemetry(10));
    source.session(session('old source'));

    const next = makeSource();
    proxy.resubscribeToBridge(next.bridge);
    source.telemetry(telemetry(20));
    source.session(session('stale'));
    const ordinary = connect();
    const lateInspector = connect();
    lateInspector.request('telemetryInspectorSubscribe', 'telemetryInspector');
    lateInspector.request('telemetryInspectorSubscribe', 'sessionData');
    expect(serializations('telemetry')).toBe(1);
    expect(serializations('sessionData')).toBe(1); // Old source cache was cleared.

    clock.mockReturnValue(100);
    next.telemetry(telemetry(30));
    next.session(session('new source'));
    expect(inspector.messages('telemetry').at(-1)?.data).toEqual(telemetry(30));
    expect(lateInspector.messages('sessionData').at(-1)?.data).toEqual(
      session('new source')
    );
    expect(serializations('telemetry')).toBe(2);
    expect(serializations('sessionData')).toBe(2);

    inspector.close();
    lateInspector.close();
    ordinary.close();
    expect(
      next.bridge.onTelemetry.mock.results[0].value
    ).toHaveBeenCalledOnce();
    const reconnected = connect();
    expect(next.bridge.onTelemetry).toHaveBeenCalledTimes(2);
    clock.mockReturnValue(200);
    next.telemetry(telemetry(40));
    next.session(session('reconnected'));
    expect(serializations('telemetry')).toBe(2);
    expect(serializations('sessionData')).toBe(2);
    reconnected.request('telemetryInspectorSubscribe', 'telemetryInspector');
    reconnected.request('telemetryInspectorSubscribe', 'sessionData');
    expect(reconnected.messages('telemetry')).toEqual([
      { type: 'telemetry', data: telemetry(40) },
    ]);
    expect(reconnected.messages('sessionData')).toEqual([
      { type: 'sessionData', data: session('reconnected') },
    ]);
  });

  it('keeps ordinary running-state, dashboard and typed-channel delivery working without Inspector demand', () => {
    const dashboardUpdated = vi.fn<DashboardBridge['dashboardUpdated']>();
    const dashboard = { widgets: [] } as DashboardLayout;
    const bus = new ChannelBus();
    const { source, connect, serializations } = setup(
      {
        getCurrentDashboard: () => dashboard,
        dashboardUpdated,
      } as unknown as DashboardBridge,
      bus
    );
    const ordinary = connect();
    expect(ordinary.messages('initialState')).toHaveLength(1);
    source.running(true);
    dashboardUpdated.mock.calls[0][0](dashboard, 'race');
    const removeRenderer = vi.spyOn(bus, 'removeRenderer');
    ordinary.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'channelSubscribe',
          data: { channel: 'session.lifecycle' },
        })
      )
    );
    bus.publish('session.lifecycle', { type: 'disconnect' });

    expect(ordinary.messages('runningState')).toEqual([
      { type: 'runningState', data: true },
    ]);
    expect(ordinary.messages('dashboardUpdated')).toEqual([
      { type: 'dashboardUpdated', data: { dashboard, profileId: 'race' } },
    ]);
    expect(ordinary.messages('channel')).toEqual([
      {
        type: 'channel',
        data: {
          channel: 'session.lifecycle',
          payload: { type: 'disconnect' },
        },
      },
    ]);
    expect(serializations('telemetry')).toBe(0);
    expect(serializations('sessionData')).toBe(0);
    expect(logger.error).not.toHaveBeenCalled();
    ordinary.close();
    expect(removeRenderer).toHaveBeenCalledOnce();
    bus.publish('session.lifecycle', { type: 'disconnect' });
    expect(ordinary.messages('channel')).toHaveLength(1);
    bus.dispose();
  });
});

describe('browser pit lane calibration requests', () => {
  it('uses the shared bridge for source-aware updates and forwards reset errors', async () => {
    const calibration = {
      trackId: '47',
      sourceId: 'source-one',
      revision: 3,
      data: null,
    };
    const pitLaneBridge: PitLaneBridge = {
      getPitLaneData: vi.fn(async () => calibration),
      updatePitLaneData: vi.fn(async () => false),
      getCurrentTrackPitLaneInfo: vi.fn(async () => null),
      resetPitLaneData: vi.fn(async () => {
        throw new Error('Track changed');
      }),
    };
    const { wss } = createBridgeProxy(
      new Server(),
      makeSource().bridge,
      undefined,
      undefined,
      pitLaneBridge
    );
    const client = new Client();
    wss.emit('connection', client);
    const request = (type: string, data: unknown) =>
      client.emit(
        'message',
        Buffer.from(JSON.stringify({ type, requestId: 'request-one', data }))
      );
    request('pitLane:getData', { trackId: '47' });
    await vi.waitFor(() =>
      expect(client.messages('pitLane:getData')[0]?.data).toEqual(calibration)
    );
    request('pitLane:updateData', {
      trackId: '47',
      revision: 3,
      sourceId: 'source-one',
      update: { pitEntryPct: 0.9 },
    });
    await vi.waitFor(() =>
      expect(pitLaneBridge.updatePitLaneData).toHaveBeenCalledWith(
        '47',
        { pitEntryPct: 0.9 },
        3,
        'source-one'
      )
    );
    expect(client.messages('pitLane:updateData')[0]?.data).toBe(false);
    request('pitLane:resetData', { trackId: '47' });
    await vi.waitFor(() =>
      expect(client.messages('pitLane:resetData')[0]).toMatchObject({
        error: 'Track changed',
      })
    );
    client.close();
  });
});
