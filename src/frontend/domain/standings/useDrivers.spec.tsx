import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useSessionStore } from '@irdashies/context';
import { mountFixture } from '../../../testing/renderWithFixture';
import type { ReplayFixture } from '../../../testing/replayFixture';
import roadAmerica from '../../../../test-data/fixtures/multiclass-road-america.json';
import { useDriverPositions, useDrivers } from './useDriverPositions';

const fixture = roadAmerica as unknown as ReplayFixture;
afterEach(() => {
  cleanup();
  useSessionStore.getState().resetSession();
});

describe('Relative driver identities', () => {
  it('retains roster identities while telemetry and parent renders continue', () => {
    const harness = mountFixture(fixture);
    const bridge = window.channelBridge;
    window.channelBridge = {
      subscribe: (channel, callback, rate) =>
        bridge.subscribe(
          channel,
          (snapshot) => callback(structuredClone(snapshot)),
          rate
        ),
    };
    const { result, rerender } = renderHook(() => ({
      drivers: useDrivers(),
      positions: useDriverPositions(),
    }));
    const roster = result.current.drivers;
    const positions = result.current.positions;
    for (let i = 0; i < 10; i++) rerender();
    expect(result.current.drivers).toBe(roster);
    act(() => harness.seekTo(0));
    expect(result.current.positions).not.toBe(positions);
    expect(result.current.drivers).toBe(roster);
    expect(result.current.drivers[0].carClass).toBe(roster[0].carClass);
  });

  it('updates driver edits, joins, departures and disconnect/reconnect', () => {
    mountFixture(fixture);
    const { result } = renderHook(() => useDrivers());
    const previous = result.current;
    const session = useSessionStore.getState().session;
    if (!session) throw new Error('fixture session missing');
    const roster = session.DriverInfo.Drivers;
    const changed = {
      ...roster[0],
      UserName: 'Updated driver',
      IRating: 2345,
      CarClassShortName: 'Updated class',
    };
    const joined = { ...roster[1], CarIdx: 99, UserName: 'Joining driver' };
    act(() =>
      useSessionStore.getState().setSession({
        ...session,
        DriverInfo: {
          ...session.DriverInfo,
          Drivers: [changed, ...roster.slice(2), joined],
        },
      })
    );
    expect(result.current).not.toBe(previous);
    expect(result.current[0]).toMatchObject({
      name: 'Updated driver',
      rating: 2345,
      carClass: { name: 'Updated class' },
    });
    expect(result.current.some((d) => d.carIdx === roster[1].CarIdx)).toBe(
      false
    );
    expect(result.current.some((d) => d.carIdx === 99)).toBe(true);
    act(() => useSessionStore.getState().resetSession());
    expect(result.current).toEqual([]);
    act(() => useSessionStore.getState().setSession(session));
    expect(result.current).toEqual(previous);
  });
});
