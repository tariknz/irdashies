import { describe, expect, it, vi } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { createSessionLifecycle } from '../sessionLifecycle';
import { IncidentRuntime } from './incidentRuntime';
import { IncidentType } from '../../types/raceControl';
import { TrackLocation, SessionState } from '../irsdk/types/enums';

const raceSession = (): Session =>
  ({
    WeekendInfo: { TrackLength: '5.000 km', SubSessionID: 123 },
    SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: 'Race' }] },
    DriverInfo: {
      Drivers: [
        {
          CarIdx: 0,
          UserName: 'Test',
          CarNumber: '99',
          TeamName: '',
          CarIsPaceCar: 0,
        },
      ],
    },
  }) as unknown as Session;

const frame = (overrides: Record<string, unknown> = {}): Telemetry =>
  ({
    SessionTime: { value: [100] },
    SessionNum: { value: [0] },
    SessionState: { value: [SessionState.Racing] },
    ReplayFrameNum: { value: [6000] },
    CarIdxLapDistPct: { value: [0.5] },
    CarIdxLap: { value: [3] },
    CarIdxTrackSurface: { value: [TrackLocation.OnTrack] },
    CarIdxSessionFlags: { value: [0] },
    CarIdxOnPitRoad: { value: [false] },
    ...overrides,
  }) as unknown as Telemetry;

// Frame step for the pit-entry sequences below. These run on the shipped
// defaults, so three frames must span more than pitEntryDurationSeconds (0.6s).
const PIT_STEP = 0.4;

const newMetrics = () => ({ markStart: vi.fn(), markEnd: vi.fn() });

describe('IncidentRuntime', () => {
  it('does not process or persist frames while Gantry is disabled', () => {
    const bus = new ChannelBus();
    const metrics = newMetrics();
    const persistence = { save: vi.fn() };
    const runtime = new IncidentRuntime(
      bus,
      createSessionLifecycle(),
      metrics,
      persistence
    );
    runtime.onSession(raceSession());
    runtime.updateEnabled(false);

    runtime.onFrame(frame());

    expect(metrics.markStart).not.toHaveBeenCalled();
    expect(persistence.save).not.toHaveBeenCalled();
  });

  it('detects, publishes, and persists incidents even with zero channel subscribers', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const metrics = newMetrics();
    const persistence = { save: vi.fn() };
    const runtime = new IncidentRuntime(
      bus,
      createSessionLifecycle(),
      metrics,
      persistence
    );

    // Regression guard: unlike FuelProjectionRuntime, there must be no
    // subscriber gate — the ChannelBus has zero subscribers throughout.
    expect(bus.subscriberCount('raceControl.incidents')).toBe(0);

    runtime.onSession(raceSession());
    runtime.onFrame(frame({ CarIdxOnPitRoad: { value: [false] } }));
    for (let i = 0; i < 3; i++) {
      runtime.onFrame(
        frame({
          CarIdxOnPitRoad: { value: [true] },
          SessionTime: { value: [100 + (i + 1) * PIT_STEP] },
        })
      );
    }

    expect(bus.subscriberCount('raceControl.incidents')).toBe(0);
    expect(publish).toHaveBeenCalledWith(
      'raceControl.incidents',
      expect.objectContaining({ type: IncidentType.PitEntry })
    );
    expect(persistence.save).toHaveBeenCalledWith(
      '123',
      expect.objectContaining({ type: IncidentType.PitEntry })
    );
    expect(metrics.markStart).toHaveBeenCalledWith('incidentProcessing');
    expect(metrics.markEnd).toHaveBeenCalledWith('incidentProcessing');
    expect(metrics.markStart).toHaveBeenCalledWith('incidentPublication');
    expect(metrics.markEnd).toHaveBeenCalledWith('incidentPublication');
  });

  it('clears a stale session id and does not persist when session data omits it', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const persistence = { save: vi.fn() };
    const runtime = new IncidentRuntime(
      bus,
      createSessionLifecycle(),
      newMetrics(),
      persistence
    );
    const session = raceSession();
    runtime.onSession(session);
    expect(runtime.getCurrentSessionId()).toBe('123');
    if (session.WeekendInfo) {
      delete (session.WeekendInfo as { SubSessionID?: number }).SubSessionID;
    }

    runtime.onSession(session);
    expect(runtime.getCurrentSessionId()).toBe('');
    expect(publish).toHaveBeenCalledWith('raceControl.sessionId', '');
    runtime.onFrame(frame());
    for (let i = 0; i < 3; i++) {
      runtime.onFrame(
        frame({
          CarIdxOnPitRoad: { value: [true] },
          SessionTime: { value: [100 + (i + 1) * PIT_STEP] },
        })
      );
    }

    expect(publish).toHaveBeenCalledWith(
      'raceControl.incidents',
      expect.objectContaining({ type: IncidentType.PitEntry })
    );
    expect(persistence.save).not.toHaveBeenCalled();
  });

  it('tracks the current session id and notifies listeners when it changes', () => {
    const bus = new ChannelBus();
    const metrics = newMetrics();
    const persistence = { save: vi.fn() };
    const runtime = new IncidentRuntime(
      bus,
      createSessionLifecycle(),
      metrics,
      persistence
    );
    const onChange = vi.fn();
    runtime.onSessionIdChanged(onChange);

    expect(runtime.getCurrentSessionId()).toBe('');

    runtime.onSession({
      WeekendInfo: { SubSessionID: 123 },
    } as unknown as Session);

    expect(runtime.getCurrentSessionId()).toBe('123');
    expect(onChange).toHaveBeenCalledWith('123');
  });

  it('resets its session id on lifecycle disconnect', () => {
    const bus = new ChannelBus();
    const metrics = newMetrics();
    const persistence = { save: vi.fn() };
    const lifecycle = createSessionLifecycle();
    const runtime = new IncidentRuntime(bus, lifecycle, metrics, persistence);

    runtime.onSession({
      WeekendInfo: { SubSessionID: 555 },
    } as unknown as Session);
    expect(runtime.getCurrentSessionId()).toBe('555');

    lifecycle._onDisconnect();
    expect(runtime.getCurrentSessionId()).toBe('');
  });

  it('publishes the session id so a Gantry opened mid-session can reload', () => {
    const bus = new ChannelBus();
    const publish = vi.spyOn(bus, 'publish');
    const metrics = newMetrics();
    const persistence = { save: vi.fn() };
    const lifecycle = createSessionLifecycle();
    const runtime = new IncidentRuntime(bus, lifecycle, metrics, persistence);

    runtime.onSession({
      WeekendInfo: { SubSessionID: 777 },
    } as unknown as Session);
    expect(publish).toHaveBeenCalledWith('raceControl.sessionId', '777');

    // Republishing an unchanged id would make the renderer drop and reload the
    // list on every session YAML tick.
    publish.mockClear();
    runtime.onSession({
      WeekendInfo: { SubSessionID: 777 },
    } as unknown as Session);
    expect(publish).not.toHaveBeenCalledWith(
      'raceControl.sessionId',
      expect.anything()
    );

    lifecycle._onDisconnect();
    expect(publish).toHaveBeenCalledWith('raceControl.sessionId', '');
  });

  it('disposes lifecycle subscriptions so later events no longer reach the processor', () => {
    const bus = new ChannelBus();
    const metrics = newMetrics();
    const persistence = { save: vi.fn() };
    const lifecycle = createSessionLifecycle();
    const runtime = new IncidentRuntime(bus, lifecycle, metrics, persistence);

    runtime.onSession({
      WeekendInfo: { SubSessionID: 42 },
    } as unknown as Session);
    expect(runtime.getCurrentSessionId()).toBe('42');

    runtime.dispose();
    lifecycle._onDisconnect();

    // The disconnect subscription was torn down, so the runtime's own
    // disconnect handler (which clears currentSessionId) must not have run.
    expect(runtime.getCurrentSessionId()).toBe('42');
  });
});
