import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IncidentType } from '@irdashies/types';
import type { ChannelBridge, Incident } from '@irdashies/types';
import { useRaceControlStore } from './RaceControlStore';
import { useRaceControlBridge } from './useRaceControlBridge';

const incident = (id: string, timestamp: number): Incident => ({
  id,
  carIdx: 1,
  driverName: 'Driver',
  carNumber: '1',
  teamName: 'Team',
  sessionNum: 0,
  sessionTime: timestamp,
  lapNum: 1,
  replayFrameNum: 0,
  type: IncidentType.OffTrack,
  lapDistPct: 0.5,
  timestamp,
});

type ChannelHandler = (payload: never) => void;

/** Records subscribers per channel so tests can drive the bridge. */
const createChannelBridge = () => {
  const handlers = new Map<string, Set<ChannelHandler>>();
  const subscribe = vi.fn((channel: string, callback: ChannelHandler) => {
    const set = handlers.get(channel) ?? new Set();
    set.add(callback);
    handlers.set(channel, set);
    return () => set.delete(callback);
  });
  const publish = (channel: string, payload: unknown) =>
    handlers.get(channel)?.forEach((callback) => callback(payload as never));
  return { bridge: { subscribe } as unknown as ChannelBridge, publish };
};

describe('useRaceControlBridge', () => {
  beforeEach(() => {
    useRaceControlStore.setState({ incidents: [], hydrationEpoch: 0 });
  });

  afterEach(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    delete (window as any).channelBridge;
    delete (window as any).raceControlBridge;
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });

  it('does not throw when neither bridge is available', () => {
    expect(() => renderHook(() => useRaceControlBridge())).not.toThrow();
  });

  it('merges the mount-time snapshot instead of clobbering live incidents', async () => {
    const { bridge, publish } = createChannelBridge();
    window.channelBridge = bridge;
    let resolveIncidents: (incidents: Incident[]) => void = () => undefined;
    window.raceControlBridge = {
      getIncidents: vi.fn(
        () => new Promise<Incident[]>((resolve) => (resolveIncidents = resolve))
      ),
    } as unknown as typeof window.raceControlBridge;

    renderHook(() => useRaceControlBridge());

    // A live incident lands before the persisted snapshot resolves.
    publish('raceControl.incidents', incident('live', 300));
    expect(useRaceControlStore.getState().incidents.map((i) => i.id)).toEqual([
      'live',
    ]);

    resolveIncidents([incident('persisted', 100)]);

    await waitFor(() =>
      expect(useRaceControlStore.getState().incidents.map((i) => i.id)).toEqual(
        ['live', 'persisted']
      )
    );
  });

  it('refetches when the active session id changes', async () => {
    const { bridge, publish } = createChannelBridge();
    window.channelBridge = bridge;
    const getIncidents = vi
      .fn<() => Promise<Incident[]>>()
      .mockResolvedValueOnce([incident('mount-session', 50)])
      .mockResolvedValueOnce([incident('sessionA', 100)])
      .mockResolvedValueOnce([incident('sessionB', 200)]);
    window.raceControlBridge = {
      getIncidents,
    } as unknown as typeof window.raceControlBridge;

    renderHook(() => useRaceControlBridge());

    // The first value can represent a transition from the SubSessionID loaded
    // on mount, so it must replace rather than merge with that snapshot.
    publish('raceControl.sessionId', '111');
    await waitFor(() =>
      expect(useRaceControlStore.getState().incidents.map((i) => i.id)).toEqual(
        ['sessionA']
      )
    );

    publish('raceControl.sessionId', '222');
    await waitFor(() =>
      expect(useRaceControlStore.getState().incidents.map((i) => i.id)).toEqual(
        ['sessionB']
      )
    );
    expect(getIncidents).toHaveBeenCalledTimes(3);
  });

  it('drops the mount-time snapshot when the first session load starts', async () => {
    const { bridge, publish } = createChannelBridge();
    window.channelBridge = bridge;
    let resolveInitial: (incidents: Incident[]) => void = () => undefined;
    const getIncidents = vi
      .fn<() => Promise<Incident[]>>()
      .mockImplementationOnce(
        () => new Promise<Incident[]>((resolve) => (resolveInitial = resolve))
      )
      .mockResolvedValueOnce([incident('current-session', 200)]);
    window.raceControlBridge = {
      getIncidents,
    } as unknown as typeof window.raceControlBridge;

    renderHook(() => useRaceControlBridge());
    publish('raceControl.sessionId', '111');

    await waitFor(() =>
      expect(useRaceControlStore.getState().incidents.map((i) => i.id)).toEqual(
        ['current-session']
      )
    );
    resolveInitial([incident('pre-session', 100)]);

    await waitFor(() => expect(getIncidents).toHaveBeenCalledTimes(2));
    expect(useRaceControlStore.getState().incidents.map((i) => i.id)).toEqual([
      'current-session',
    ]);
  });

  it('ignores a repeated session id', async () => {
    const { bridge, publish } = createChannelBridge();
    window.channelBridge = bridge;
    const getIncidents = vi
      .fn<() => Promise<Incident[]>>()
      .mockResolvedValue([]);
    window.raceControlBridge = {
      getIncidents,
    } as unknown as typeof window.raceControlBridge;

    renderHook(() => useRaceControlBridge());
    await waitFor(() => expect(getIncidents).toHaveBeenCalledTimes(1));

    publish('raceControl.sessionId', '111');
    publish('raceControl.sessionId', '111');

    await waitFor(() => expect(getIncidents).toHaveBeenCalledTimes(2));
  });

  it('keeps the list on disconnect', async () => {
    const { bridge, publish } = createChannelBridge();
    window.channelBridge = bridge;
    const getIncidents = vi
      .fn<() => Promise<Incident[]>>()
      .mockResolvedValue([]);
    window.raceControlBridge = {
      getIncidents,
    } as unknown as typeof window.raceControlBridge;

    renderHook(() => useRaceControlBridge());
    publish('raceControl.sessionId', '111');
    publish('raceControl.incidents', incident('live', 300));
    await waitFor(() => expect(getIncidents).toHaveBeenCalledTimes(2));

    publish('raceControl.sessionId', '');

    expect(useRaceControlStore.getState().incidents.map((i) => i.id)).toEqual([
      'live',
    ]);
    expect(getIncidents).toHaveBeenCalledTimes(2);
  });

  it('reloads persisted incidents when the Gantry becomes visible', async () => {
    const { bridge } = createChannelBridge();
    window.channelBridge = bridge;
    const getIncidents = vi
      .fn<() => Promise<Incident[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([incident('while-hidden', 200)]);
    window.raceControlBridge = {
      getIncidents,
    } as unknown as typeof window.raceControlBridge;
    const visibilityState = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible');

    renderHook(() => useRaceControlBridge());
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() =>
      expect(useRaceControlStore.getState().incidents.map((i) => i.id)).toEqual(
        ['while-hidden']
      )
    );
    expect(getIncidents).toHaveBeenCalledTimes(2);
    visibilityState.mockRestore();
  });

  it('drops a snapshot that resolves after the session changed', async () => {
    const { bridge, publish } = createChannelBridge();
    window.channelBridge = bridge;
    let resolveFirst: (incidents: Incident[]) => void = () => undefined;
    const getIncidents = vi
      .fn<() => Promise<Incident[]>>()
      .mockImplementationOnce(
        () => new Promise<Incident[]>((resolve) => (resolveFirst = resolve))
      )
      .mockResolvedValue([]);
    window.raceControlBridge = {
      getIncidents,
    } as unknown as typeof window.raceControlBridge;

    renderHook(() => useRaceControlBridge());

    publish('raceControl.sessionId', '111');
    publish('raceControl.sessionId', '222');
    // The first session's file finally responds — too late to matter.
    resolveFirst([incident('sessionA', 100)]);

    await waitFor(() => expect(getIncidents).toHaveBeenCalledTimes(3));
    expect(useRaceControlStore.getState().incidents).toEqual([]);
  });
});
