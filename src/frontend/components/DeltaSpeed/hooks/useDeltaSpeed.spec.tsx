import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import type { ReferenceLap, Session } from '@irdashies/types';
import { useReferenceLapStore, useSessionStore } from '@irdashies/context';
import { useDeltaSpeed } from './useDeltaSpeed';
import { buildMockSpeedLap, mockSpeedAt } from '../mockSpeedLap';
import { seedTrackState } from '../mockTrackState';

const PLAYER_CAR_IDX = 3;

const seedSession = () =>
  useSessionStore.setState({
    session: {
      DriverInfo: {
        DriverCarIdx: PLAYER_CAR_IDX,
        Drivers: [{ CarIdx: PLAYER_CAR_IDX, CarClassID: 10 }],
      },
    } as unknown as Session,
  });

const seedTrack = (speedMs: number, lapDistPct: number) =>
  seedTrackState({ speed: speedMs, lapDistPct });

const seedBestLap = (lap: ReferenceLap | null) =>
  useReferenceLapStore.setState({
    bestLaps: lap ? new Map([[PLAYER_CAR_IDX, lap]]) : new Map(),
  });

describe('useDeltaSpeed', () => {
  beforeEach(() => {
    useReferenceLapStore.getState().completeSession();
    useSessionStore.setState({ session: null });
  });

  it('returns null before any clean lap has been set', () => {
    seedSession();
    seedTrack(50, 0.5);

    const { result } = renderHook(() => useDeltaSpeed());
    expect(result.current).toBeNull();
  });

  it('returns zero when matching the reference exactly', () => {
    const lap = buildMockSpeedLap();
    seedSession();
    seedBestLap(lap);

    const pct = lap.pointPos[200];
    seedTrack(mockSpeedAt(pct) / 3.6, pct);

    const { result } = renderHook(() => useDeltaSpeed());
    expect(result.current).toBeCloseTo(0, 1);
  });

  it('returns a positive delta when faster than the reference', () => {
    const lap = buildMockSpeedLap();
    seedSession();
    seedBestLap(lap);

    const pct = lap.pointPos[200];
    // 10 km/h quicker than the reference at this point
    seedTrack((mockSpeedAt(pct) + 10) / 3.6, pct);

    const { result } = renderHook(() => useDeltaSpeed());
    expect(result.current).toBeCloseTo(10, 1);
  });

  it('returns a negative delta when slower than the reference', () => {
    const lap = buildMockSpeedLap();
    seedSession();
    seedBestLap(lap);

    const pct = lap.pointPos[350];
    seedTrack((mockSpeedAt(pct) - 7.5) / 3.6, pct);

    const { result } = renderHook(() => useDeltaSpeed());
    expect(result.current).toBeCloseTo(-7.5, 1);
  });

  it('returns null for a reference lap with no speed trace', () => {
    // An opponent-sourced or pre-upgrade lap.
    seedSession();
    seedBestLap(buildMockSpeedLap({ withoutSpeeds: true }));
    seedTrack(50, 0.5);

    const { result } = renderHook(() => useDeltaSpeed());
    expect(result.current).toBeNull();
  });

  it('returns null for a lap whose speed trace starts partway round', () => {
    const partial = buildMockSpeedLap();
    const speeds = partial.speedsKph ?? new Float32Array();
    for (let i = 0; i < 40; i++) speeds[i] = 0;

    seedSession();
    seedBestLap(partial);
    // Even well past the missing span, the whole lap is rejected rather than
    // blanking the bar across part of every lap.
    seedTrack(50, 0.5);

    const { result } = renderHook(() => useDeltaSpeed());
    expect(result.current).toBeNull();
  });

  it('returns null when off track (LapDistPct is -1)', () => {
    seedSession();
    seedBestLap(buildMockSpeedLap());
    seedTrack(0, -1);

    const { result } = renderHook(() => useDeltaSpeed());
    expect(result.current).toBeNull();
  });

  it('does not fall back to the persisted class ghost', () => {
    // The class ghost may be an AI's lap. Even a complete one must not be used.
    seedSession();
    useReferenceLapStore.setState({
      bestLaps: new Map(),
      persistedLaps: new Map([[10, buildMockSpeedLap()]]),
    });
    seedTrack(50, 0.5);

    const { result } = renderHook(() => useDeltaSpeed());
    expect(result.current).toBeNull();
  });
});
