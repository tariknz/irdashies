import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ChannelBridge,
  PitLaneBridge,
  PitLaneCalibration,
  Session,
} from '@irdashies/types';
import { useSessionStore } from '../SessionStore/SessionStore';
import { usePitLaneStore } from './PitLaneStore';
import { PitLaneProvider } from './PitLaneProvider';

let telemetry: readonly [
  readonly boolean[],
  readonly number[],
  readonly number[],
];
vi.mock('../ChannelStore', () => ({ useTrackStateSelector: () => telemetry }));
vi.mock('@irdashies/utils/logger', () => ({ default: { error: vi.fn() } }));
const callbacks = new Set<(value: PitLaneCalibration) => void>();
const learned = { pitEntryPct: 0.95, pitExitPct: 0.08 };
let bridge: PitLaneBridge;

beforeEach(() => {
  callbacks.clear();
  telemetry = [[false], [3], [0.9]];
  usePitLaneStore.getState().reset();
  useSessionStore.setState({
    session: { WeekendInfo: { TrackID: 47 } } as Session,
  });
  window.channelBridge = {
    subscribe: (
      _channel: unknown,
      callback: (value: PitLaneCalibration) => void
    ) => {
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
      };
    },
  } as unknown as ChannelBridge;
  bridge = {
    getPitLaneData: vi.fn(async (trackId) => ({
      trackId,
      sourceId: 'test-source',
      revision: 0,
      data: learned,
    })),
    updatePitLaneData: vi.fn(async () => true),
    getCurrentTrackPitLaneInfo: vi.fn(async () => null),
    resetPitLaneData: vi.fn(async () => undefined),
  };
});

const resetFromAnotherWindow = (trackId = '47') => {
  act(() =>
    callbacks.forEach((callback) =>
      callback({ trackId, sourceId: 'test-source', revision: 1, data: null })
    )
  );
};

describe('PitLaneProvider reset and persistence', () => {
  it('hydrates without re-saving learned values and removes its reset listener', async () => {
    const { unmount } = render(<PitLaneProvider bridge={bridge} />);
    await waitFor(() =>
      expect(usePitLaneStore.getState().pitEntryPct).toBe(0.95)
    );
    expect(bridge.updatePitLaneData).not.toHaveBeenCalled();
    unmount();
    expect(callbacks.size).toBe(0);
  });

  it('clears running data from another window and relearns only from fresh entry/exit transitions', async () => {
    const view = render(<PitLaneProvider bridge={bridge} />);
    await waitFor(() =>
      expect(usePitLaneStore.getState().pitEntryPct).toBe(0.95)
    );
    resetFromAnotherWindow();
    expect(usePitLaneStore.getState().pitEntryPct).toBeNull();
    expect(usePitLaneStore.getState().pitExitPct).toBeNull();
    expect(bridge.updatePitLaneData).not.toHaveBeenCalled();
    telemetry = [[true], [2], [0.91]];
    view.rerender(<PitLaneProvider bridge={bridge} />);
    expect(usePitLaneStore.getState().pitEntryPct).toBe(0.9);
    expect(bridge.updatePitLaneData).toHaveBeenCalledWith(
      '47',
      { pitEntryPct: 0.9 },
      1,
      'test-source'
    );
    telemetry = [[false], [2], [0.05]];
    view.rerender(<PitLaneProvider bridge={bridge} />);
    expect(usePitLaneStore.getState().pitExitPct).toBe(0.05);
    expect(bridge.updatePitLaneData).toHaveBeenCalledWith(
      '47',
      { pitExitPct: 0.05 },
      1,
      'test-source'
    );
  });

  it('does not clear the current track when another track is reset', async () => {
    render(<PitLaneProvider bridge={bridge} />);
    await waitFor(() =>
      expect(usePitLaneStore.getState().pitEntryPct).toBe(0.95)
    );
    resetFromAnotherWindow('181');
    expect(usePitLaneStore.getState().pitEntryPct).toBe(0.95);
  });

  it('ignores an old in-flight hydration that resolves after reset', async () => {
    let finishLoad!: (value: PitLaneCalibration) => void;
    bridge.getPitLaneData = vi.fn(
      () =>
        new Promise<PitLaneCalibration>((resolve) => {
          finishLoad = resolve;
        })
    );
    render(<PitLaneProvider bridge={bridge} />);
    await waitFor(() => expect(bridge.getPitLaneData).toHaveBeenCalled());
    resetFromAnotherWindow();
    await act(async () =>
      finishLoad({
        trackId: '47',
        sourceId: 'test-source',
        revision: 0,
        data: learned,
      })
    );
    expect(usePitLaneStore.getState().pitEntryPct).toBeNull();
    expect(usePitLaneStore.getState().calibrationRevision).toBe(1);
    expect(bridge.updatePitLaneData).not.toHaveBeenCalled();
  });

  it('cancels a previous-track load so it cannot overwrite the new track', async () => {
    let finishLoad!: (value: PitLaneCalibration) => void;
    vi.mocked(bridge.getPitLaneData).mockImplementationOnce(
      () =>
        new Promise<PitLaneCalibration>((resolve) => {
          finishLoad = resolve;
        })
    );
    const view = render(<PitLaneProvider bridge={bridge} />);
    await waitFor(() =>
      expect(bridge.getPitLaneData).toHaveBeenCalledWith('47')
    );
    act(() =>
      useSessionStore.setState({
        session: { WeekendInfo: { TrackID: 181 } } as Session,
      })
    );
    view.rerender(<PitLaneProvider bridge={bridge} />);
    await waitFor(() =>
      expect(usePitLaneStore.getState().currentTrackId).toBe('181')
    );
    await act(async () =>
      finishLoad({
        trackId: '47',
        sourceId: 'test-source',
        revision: 0,
        data: learned,
      })
    );
    expect(usePitLaneStore.getState().currentTrackId).toBe('181');
  });
  it('accepts a new main-instance identity even when its revision starts again at zero', async () => {
    const view = render(<PitLaneProvider bridge={bridge} />);
    await waitFor(() =>
      expect(usePitLaneStore.getState().pitEntryPct).toBe(0.95)
    );
    act(() =>
      callbacks.forEach((callback) =>
        callback({
          trackId: '47',
          sourceId: 'new-instance',
          revision: 0,
          data: null,
        })
      )
    );
    expect(usePitLaneStore.getState().calibrationRevision).toBe(0);
    expect(usePitLaneStore.getState().calibrationSourceId).toBe('new-instance');
    expect(usePitLaneStore.getState().pitEntryPct).toBeNull();
    telemetry = [[true], [2], [0.91]];
    view.rerender(<PitLaneProvider bridge={bridge} />);
    expect(usePitLaneStore.getState().pitEntryPct).toBe(0.9);
    expect(bridge.updatePitLaneData).toHaveBeenCalledWith(
      '47',
      { pitEntryPct: 0.9 },
      0,
      'new-instance'
    );
  });

  it('ignores a previous main instance response that arrives after reconnect', async () => {
    let finishLoad!: (value: PitLaneCalibration) => void;
    bridge.getPitLaneData = vi.fn(
      () =>
        new Promise<PitLaneCalibration>((resolve) => {
          finishLoad = resolve;
        })
    );
    render(<PitLaneProvider bridge={bridge} />);
    await waitFor(() => expect(bridge.getPitLaneData).toHaveBeenCalled());
    act(() =>
      callbacks.forEach((callback) =>
        callback({
          trackId: '47',
          sourceId: 'new-instance',
          revision: 0,
          data: null,
        })
      )
    );
    await act(async () =>
      finishLoad({
        trackId: '47',
        sourceId: 'test-source',
        revision: 5,
        data: learned,
      })
    );
    expect(usePitLaneStore.getState().calibrationSourceId).toBe('new-instance');
    expect(usePitLaneStore.getState().pitEntryPct).toBeNull();
  });
  it('applies edited values from a file reload without saving the previous calibration again', async () => {
    render(<PitLaneProvider bridge={bridge} />);
    await waitFor(() =>
      expect(usePitLaneStore.getState().pitEntryPct).toBe(0.95)
    );
    act(() =>
      callbacks.forEach((callback) =>
        callback({
          trackId: '47',
          sourceId: 'test-source',
          revision: 1,
          data: { pitEntryPct: 0.8, pitExitPct: null },
        })
      )
    );
    expect(usePitLaneStore.getState().pitEntryPct).toBe(0.8);
    expect(usePitLaneStore.getState().pitExitPct).toBeNull();
    expect(bridge.updatePitLaneData).not.toHaveBeenCalled();
  });
});
