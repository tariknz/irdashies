import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LmuTrackMap, Session } from '@irdashies/types';
import { useSessionStore } from '@irdashies/context';
import {
  closeLmuTrackLoop,
  useSessionTrackDrawing,
} from './useSessionTrackDrawing';
import { useTrackDrawing } from './useTrackDrawing';
import type { TrackDrawing } from './trackDrawing';

vi.mock('@irdashies/context', async () => {
  const { create } = await import('zustand');
  return {
    useSessionStore: create(() => ({ session: null })),
  };
});
vi.mock('./useTrackDrawing', () => ({ useTrackDrawing: vi.fn() }));

const bundled: TrackDrawing = {
  active: { inside: 'M0 0', outside: '' },
  startFinish: {},
};

const lmuMap: LmuTrackMap = {
  orientation: 'lmu-ccw-v1',
  active: {
    inside: 'M0,0 L10,0 L10,10 L0,10 Z',
    outside: 'M0,0 L10,0 L10,10 L0,10 Z',
    trackPathPoints: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    totalLength: 3,
  },
  startFinish: {
    line: 'M0,-30 L0,30',
    point: { x: 0, y: 0, length: 0 },
    direction: 'anticlockwise',
  },
};

const withSession = (
  session: {
    LmuTrackMap?: LmuTrackMap;
    WeekendInfo?: { TrackName: string };
  } | null
) => useSessionStore.setState({ session: session as Session | null });

describe('useSessionTrackDrawing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useTrackDrawing).mockReturnValue(bundled);
    withSession(null);
  });

  it('uses the bundled drawing when the session carries no LMU map', () => {
    withSession({});
    const { result } = renderHook(() => useSessionTrackDrawing(42));

    expect(result.current).toBe(bundled);
    expect(useTrackDrawing).toHaveBeenCalledWith(42);
  });

  it('uses the LMU map and loads nothing by track id when one is present', () => {
    withSession({ LmuTrackMap: lmuMap });
    const { result } = renderHook(() => useSessionTrackDrawing(1_234_567));

    expect(result.current?.active.inside).toBe(lmuMap.active.inside);
    expect(useTrackDrawing).toHaveBeenCalledWith(undefined);
  });

  it('adds the corners of a known LMU track to its map', () => {
    withSession({
      LmuTrackMap: lmuMap,
      WeekendInfo: { TrackName: 'Circuit de la Sarthe' },
    });
    const { result } = renderHook(() => useSessionTrackDrawing(1_234_567));

    expect(result.current?.turns?.length).toBeGreaterThan(0);
    expect(result.current?.turns?.[0].content).toBe('1');
  });

  it('leaves the map without corners for a track it does not know', () => {
    withSession({
      LmuTrackMap: lmuMap,
      WeekendInfo: { TrackName: 'Unknown Test Circuit' },
    });
    const { result } = renderHook(() => useSessionTrackDrawing(1_234_567));

    expect(result.current?.turns).toBeUndefined();
  });

  it('keeps the same drawing when a session update carries the same map', () => {
    withSession({ LmuTrackMap: lmuMap });
    const { result } = renderHook(() => useSessionTrackDrawing(1_234_567));
    const first = result.current;

    act(() => {
      withSession({ LmuTrackMap: structuredClone(lmuMap) });
    });

    expect(result.current).toBe(first);
  });

  it('shows nothing while the widget is gated off, LMU or not', () => {
    withSession({ LmuTrackMap: lmuMap });
    const { result } = renderHook(() => useSessionTrackDrawing(undefined));

    expect(result.current).toBeNull();
  });

  it('shows nothing before a session arrives', () => {
    vi.mocked(useTrackDrawing).mockReturnValue(null);
    const { result } = renderHook(() => useSessionTrackDrawing(5));

    expect(result.current).toBeNull();
  });
});

describe('closeLmuTrackLoop', () => {
  it('ends the path back at the start so the last stretch of the lap is drawn', () => {
    const closed = closeLmuTrackLoop(lmuMap);
    const points = closed.active.trackPathPoints ?? [];

    expect(points).toHaveLength(5);
    expect(points[4]).toEqual(points[0]);
    expect(closed.active.totalLength).toBeCloseTo(4);
  });

  it('leaves a path that already ends at its start alone', () => {
    const closedAlready = closeLmuTrackLoop(lmuMap) as LmuTrackMap;

    expect(closeLmuTrackLoop(closedAlready)).toBe(closedAlready);
  });
});
