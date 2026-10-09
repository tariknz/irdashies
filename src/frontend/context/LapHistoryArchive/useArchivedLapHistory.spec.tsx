import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LapHistoryBridge, LapHistorySnapshot } from '@irdashies/types';
import { useArchivedLapHistory } from './useArchivedLapHistory';

const history = (sessionNum: number) =>
  ({ sessionNum, version: 1 }) as LapHistorySnapshot;

const installBridge = (getArchived: LapHistoryBridge['getArchived']) => {
  window.lapHistoryBridge = { getArchived };
};

describe('useArchivedLapHistory', () => {
  afterEach(() => {
    delete window.lapHistoryBridge;
  });

  it('loads nothing for a null session', () => {
    const getArchived = vi.fn(() => Promise.resolve(history(0)));
    installBridge(getArchived);

    const { result } = renderHook(() => useArchivedLapHistory(null));

    expect(result.current).toBeNull();
    expect(getArchived).not.toHaveBeenCalled();
  });

  it('returns null without a bridge', () => {
    const { result } = renderHook(() => useArchivedLapHistory(1));

    expect(result.current).toBeNull();
  });

  it('loads the requested session', async () => {
    const getArchived = vi.fn((sessionNum: number) =>
      Promise.resolve(history(sessionNum))
    );
    installBridge(getArchived);

    const { result } = renderHook(() => useArchivedLapHistory(2, 'event'));

    await waitFor(() => expect(result.current?.sessionNum).toBe(2));
    expect(getArchived).toHaveBeenCalledWith(2);
  });

  it('never returns the previous session while the next one loads', async () => {
    let resolveSecond: (value: LapHistorySnapshot | null) => void = () =>
      undefined;
    const getArchived = vi
      .fn<LapHistoryBridge['getArchived']>()
      .mockResolvedValueOnce(history(1))
      .mockImplementationOnce(
        () =>
          new Promise<LapHistorySnapshot | null>(
            (resolve) => (resolveSecond = resolve)
          )
      );
    installBridge(getArchived);

    const { result, rerender } = renderHook(
      ({ sessionNum }) => useArchivedLapHistory(sessionNum, 'event'),
      { initialProps: { sessionNum: 1 } }
    );
    await waitFor(() => expect(result.current?.sessionNum).toBe(1));

    rerender({ sessionNum: 2 });
    expect(result.current).toBeNull();

    resolveSecond(history(2));
    await waitFor(() => expect(result.current?.sessionNum).toBe(2));
  });

  it('refetches when the event changes', async () => {
    const getArchived = vi.fn(() => Promise.resolve(history(0)));
    installBridge(getArchived);

    const { rerender } = renderHook(
      ({ eventId }) => useArchivedLapHistory(0, eventId),
      { initialProps: { eventId: 'a' } }
    );
    await waitFor(() => expect(getArchived).toHaveBeenCalledTimes(1));

    rerender({ eventId: 'b' });

    await waitFor(() => expect(getArchived).toHaveBeenCalledTimes(2));
  });
});
