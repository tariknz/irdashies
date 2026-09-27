import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ActiveSimulator } from '@irdashies/types';
import {
  useActiveSimulator,
  useAvailableSimulators,
} from './useActiveSimulator';

type ChangeCallback = (value: ActiveSimulator | null) => void;

const setBridge = (bridge: unknown) => {
  (window as unknown as { dashboardBridge?: unknown }).dashboardBridge = bridge;
};

afterEach(() => {
  setBridge(undefined);
});

describe('useActiveSimulator', () => {
  it('seeds from the main process', async () => {
    setBridge({
      getActiveSimulator: () => Promise.resolve('iracing'),
      onSimulatorChanged: () => () => undefined,
    });

    const { result } = renderHook(() => useActiveSimulator());

    await waitFor(() => expect(result.current).toBe('iracing'));
  });

  it('does not let a stale snapshot overwrite a newer change', async () => {
    // The settings window is usually opened long after the bridge picked a sim,
    // so the seeding request and a change event can be in flight together. The
    // request answers for the moment it was made; once something newer has
    // landed it must not win.
    let resolveSnapshot: (value: ActiveSimulator | null) => void = () =>
      undefined;
    let emit: ChangeCallback = () => undefined;

    setBridge({
      getActiveSimulator: () =>
        new Promise<ActiveSimulator | null>((resolve) => {
          resolveSnapshot = resolve;
        }),
      onSimulatorChanged: (callback: ChangeCallback) => {
        emit = callback;
        return () => undefined;
      },
    });

    const { result } = renderHook(() => useActiveSimulator());

    await act(async () => {
      emit('lmu');
    });
    expect(result.current).toBe('lmu');

    // The snapshot answers last, carrying the value from before the change.
    // Flushed inside act so the assertion sees any state update it triggers
    // rather than a stale render.
    await act(async () => {
      resolveSnapshot('iracing');
      await Promise.resolve();
    });

    expect(result.current).toBe('lmu');
  });

  it('reports nothing detected while the bridge is silent', () => {
    setBridge({});
    const { result } = renderHook(() => useActiveSimulator());
    expect(result.current).toBeNull();
  });
});

describe('useAvailableSimulators', () => {
  it('starts with nothing confirmed, then takes the registry answer', async () => {
    // Offering a simulator before the registry has answered lets the user pin a
    // source this build cannot read, and that choice persists.
    setBridge({
      getAvailableSimulators: () => Promise.resolve(['iracing']),
    });

    const { result } = renderHook(() => useAvailableSimulators());
    expect(result.current).toEqual([]);

    await waitFor(() => expect(result.current).toEqual(['iracing']));
  });

  it('offers every known simulator when the bridge cannot answer at all', async () => {
    // No answer is coming, so a permanently greyed dropdown would be worse than
    // offering the ids and letting the selection fall back to detection.
    setBridge({});

    const { result } = renderHook(() => useAvailableSimulators());

    await waitFor(() => expect(result.current).toContain('iracing'));
    expect(result.current).toContain('lmu');
  });
});
