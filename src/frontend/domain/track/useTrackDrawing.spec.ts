import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrackDrawing } from './useTrackDrawing';
import { loadTrackDrawing } from './trackDrawingLoader';
import type { TrackDrawing } from './trackDrawing';

vi.mock('./trackDrawingLoader', () => ({ loadTrackDrawing: vi.fn() }));

const drawing: TrackDrawing = {
  active: { inside: 'M0 0', outside: '' },
  startFinish: {},
};

const deferred = () => {
  let resolve!: (value: TrackDrawing | null) => void;
  const promise = new Promise<TrackDrawing | null>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('useTrackDrawing', () => {
  beforeEach(() => vi.resetAllMocks());

  it('does not request data without an active track', () => {
    const { result } = renderHook(() => useTrackDrawing(undefined));
    expect(result.current).toBeNull();
    expect(loadTrackDrawing).not.toHaveBeenCalled();
  });

  it('loads the requested drawing and immediately hides it on track changes', async () => {
    const next = deferred();
    vi.mocked(loadTrackDrawing)
      .mockResolvedValueOnce(drawing)
      .mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(
      ({ id }: { id: number | undefined }) => useTrackDrawing(id),
      { initialProps: { id: 1 as number | undefined } }
    );
    await waitFor(() => expect(result.current).toBe(drawing));
    rerender({ id: 2 });
    expect(result.current).toBeNull();
    const replacement = { ...drawing, turns: [{ content: 'New track' }] };
    await act(async () => next.resolve(replacement));
    expect(result.current).toBe(replacement);
    rerender({ id: undefined });
    expect(result.current).toBeNull();
    expect(loadTrackDrawing).toHaveBeenCalledTimes(2);
  });

  it('ignores a late response for a previous track', async () => {
    const first = deferred();
    vi.mocked(loadTrackDrawing)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(drawing);
    const { result, rerender } = renderHook(({ id }) => useTrackDrawing(id), {
      initialProps: { id: 1 },
    });
    rerender({ id: 2 });
    await waitFor(() => expect(result.current).toBe(drawing));
    await act(async () => first.resolve({ ...drawing, turns: [] }));
    expect(result.current).toBe(drawing);
  });

  it('ignores a pending response after loading is disabled', async () => {
    const first = deferred();
    vi.mocked(loadTrackDrawing).mockReturnValue(first.promise);
    const { result, rerender } = renderHook(
      ({ id }: { id: number | undefined }) => useTrackDrawing(id),
      { initialProps: { id: 1 as number | undefined } }
    );
    rerender({ id: undefined });
    await act(async () => first.resolve(drawing));
    expect(result.current).toBeNull();
  });
});
