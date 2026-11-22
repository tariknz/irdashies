import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LmuTrackMap } from '@irdashies/types';
import { useSessionStore } from '@irdashies/context';
import { useSessionTrackDrawing } from './useSessionTrackDrawing';
import { useTrackDrawing } from './useTrackDrawing';
import type { TrackDrawing } from './trackDrawing';

vi.mock('@irdashies/context', () => ({ useSessionStore: vi.fn() }));
vi.mock('./useTrackDrawing', () => ({ useTrackDrawing: vi.fn() }));

const bundled: TrackDrawing = {
  active: { inside: 'M0 0', outside: '' },
  startFinish: {},
};

const lmuMap: LmuTrackMap = {
  orientation: 'lmu-ccw-v1',
  active: {
    inside: 'M1 1 Z',
    outside: 'M1 1 Z',
    trackPathPoints: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    totalLength: 1,
  },
  startFinish: {
    line: 'M0,0 L0,1',
    point: { x: 0, y: 0, length: 0 },
    direction: 'anticlockwise',
  },
};

const withSession = (session: { LmuTrackMap?: LmuTrackMap } | undefined) =>
  vi
    .mocked(useSessionStore)
    .mockImplementation(((selector: (state: unknown) => unknown) =>
      selector({ session })) as unknown as typeof useSessionStore);

describe('useSessionTrackDrawing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useTrackDrawing).mockReturnValue(bundled);
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

    expect(result.current).toBe(lmuMap);
    expect(useTrackDrawing).toHaveBeenCalledWith(undefined);
  });

  it('shows nothing while the widget is gated off, LMU or not', () => {
    withSession({ LmuTrackMap: lmuMap });
    const { result } = renderHook(() => useSessionTrackDrawing(undefined));

    expect(result.current).toBeNull();
  });

  it('shows nothing before a session arrives', () => {
    withSession(undefined);
    vi.mocked(useTrackDrawing).mockReturnValue(null);
    const { result } = renderHook(() => useSessionTrackDrawing(5));

    expect(result.current).toBeNull();
  });
});
