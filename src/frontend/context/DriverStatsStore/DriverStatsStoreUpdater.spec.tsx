import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { Driver, Session } from '@irdashies/types';
import { useSessionStore } from '../SessionStore/SessionStore';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { DriverStatsStoreUpdater } from './DriverStatsStoreUpdater';
import { useDriverStatsStore } from './DriverStatsStore';

const buildDriver = (
  carIdx: number,
  iRating: number,
  options: { classId?: number; incidents?: number } = {}
): Driver =>
  ({
    CarIdx: carIdx,
    IRating: iRating,
    CarClassID: options.classId ?? 100,
    IsSpectator: 0,
    CarIsPaceCar: 0,
    CurDriverIncidentCount: options.incidents ?? 0,
  }) as unknown as Driver;

const buildSession = (
  drivers: Driver[],
  positions: { CarIdx: number; ClassPosition: number }[],
  { official = 1 }: { official?: 0 | 1 } = {}
): Session =>
  ({
    WeekendInfo: { Official: official },
    DriverInfo: { Drivers: drivers },
    SessionInfo: {
      Sessions: [
        {
          SessionNum: 0,
          SessionType: 'Race',
          ResultsPositions: positions,
        },
      ],
    },
  }) as unknown as Session;

describe('DriverStatsStoreUpdater', () => {
  beforeEach(() => {
    useDriverStatsStore.setState({ iratingChanges: {}, positionChanges: {} });
    useSessionStore.getState().resetSession();
    useTelemetryStore.getState().setTelemetry({
      SessionNum: { value: [0] },
    } as never);
  });

  it('populates iratingChanges on first render of an official race', () => {
    useSessionStore.getState().setSession(
      buildSession(
        [buildDriver(0, 2000), buildDriver(1, 1500)],
        [
          { CarIdx: 0, ClassPosition: 0 },
          { CarIdx: 1, ClassPosition: 1 },
        ]
      )
    );

    render(<DriverStatsStoreUpdater />);

    const { iratingChanges } = useDriverStatsStore.getState();
    expect(Object.keys(iratingChanges).sort()).toEqual(['0', '1']);
    expect(typeof iratingChanges[0]).toBe('number');
    expect(typeof iratingChanges[1]).toBe('number');
  });

  it('preserves iratingChanges identity when only incident count changes', () => {
    useSessionStore.getState().setSession(
      buildSession(
        [
          buildDriver(0, 2000, { incidents: 0 }),
          buildDriver(1, 1500, { incidents: 0 }),
        ],
        [
          { CarIdx: 0, ClassPosition: 0 },
          { CarIdx: 1, ClassPosition: 1 },
        ]
      )
    );

    render(<DriverStatsStoreUpdater />);
    const firstChanges = useDriverStatsStore.getState().iratingChanges;
    expect(Object.keys(firstChanges).length).toBe(2);

    // Same IRating + class positions, only incident counts changed.
    act(() => {
      useSessionStore.getState().setSession(
        buildSession(
          [
            buildDriver(0, 2000, { incidents: 1 }),
            buildDriver(1, 1500, { incidents: 2 }),
          ],
          [
            { CarIdx: 0, ClassPosition: 0 },
            { CarIdx: 1, ClassPosition: 1 },
          ]
        )
      );
    });

    expect(useDriverStatsStore.getState().iratingChanges).toBe(firstChanges);
  });

  it('produces a new iratingChanges record when a driver IRating changes', () => {
    useSessionStore.getState().setSession(
      buildSession(
        [buildDriver(0, 2000), buildDriver(1, 1500)],
        [
          { CarIdx: 0, ClassPosition: 0 },
          { CarIdx: 1, ClassPosition: 1 },
        ]
      )
    );

    render(<DriverStatsStoreUpdater />);
    const firstChanges = useDriverStatsStore.getState().iratingChanges;

    act(() => {
      useSessionStore.getState().setSession(
        buildSession(
          [buildDriver(0, 2050), buildDriver(1, 1500)],
          [
            { CarIdx: 0, ClassPosition: 0 },
            { CarIdx: 1, ClassPosition: 1 },
          ]
        )
      );
    });

    expect(useDriverStatsStore.getState().iratingChanges).not.toBe(
      firstChanges
    );
  });

  it('produces a new iratingChanges record when class positions swap', () => {
    useSessionStore.getState().setSession(
      buildSession(
        [buildDriver(0, 2000), buildDriver(1, 1500)],
        [
          { CarIdx: 0, ClassPosition: 0 },
          { CarIdx: 1, ClassPosition: 1 },
        ]
      )
    );

    render(<DriverStatsStoreUpdater />);
    const firstChanges = useDriverStatsStore.getState().iratingChanges;

    act(() => {
      useSessionStore.getState().setSession(
        buildSession(
          [buildDriver(0, 2000), buildDriver(1, 1500)],
          [
            { CarIdx: 0, ClassPosition: 1 },
            { CarIdx: 1, ClassPosition: 0 },
          ]
        )
      );
    });

    expect(useDriverStatsStore.getState().iratingChanges).not.toBe(
      firstChanges
    );
  });

  it('leaves iratingChanges empty for unofficial sessions', () => {
    useSessionStore.getState().setSession(
      buildSession(
        [buildDriver(0, 2000), buildDriver(1, 1500)],
        [
          { CarIdx: 0, ClassPosition: 0 },
          { CarIdx: 1, ClassPosition: 1 },
        ],
        { official: 0 }
      )
    );

    render(<DriverStatsStoreUpdater />);

    expect(useDriverStatsStore.getState().iratingChanges).toEqual({});
  });
});
