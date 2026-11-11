import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LAP_TRACE_COLORS,
  type ChannelBridge,
  type TrackStateSnapshot,
} from '@irdashies/types';
import { useLapTraceStore } from '@irdashies/context';
import { hydrateLapTrace } from '@irdashies/domain/lapTrace/hydrateLapTrace';
import { makeSyntheticLapTrace } from '../fixtures/syntheticLap';
import { BrakeCue } from '../components/BrakeCue';

vi.mock('@irdashies/utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@irdashies/utils/brakeCueAudio', () => ({
  playBrakeCue: vi.fn(),
  primeBrakeCueAudio: vi.fn(),
  setBrakeCueOutputDevice: vi.fn(),
}));

const TRACK_LENGTH_M = 5000;
const CUE_POINTS_M = new Float32Array([1000]);

/** A bridge that delivers track-state snapshots when told to. */
const trackStateBridge = () => {
  let deliver: ((payload: TrackStateSnapshot) => void) | undefined;
  let sessionTime = 100;
  window.channelBridge = {
    subscribe: (
      channel: string,
      callback: (payload: TrackStateSnapshot) => void
    ) => {
      if (channel === 'track-state.snapshot') deliver = callback;
      return () => undefined;
    },
  } as unknown as ChannelBridge;
  return (distanceM: number) => {
    sessionTime += 0.04;
    deliver?.({
      lapDistPct: distanceM / TRACK_LENGTH_M,
      // Faster than the reference anywhere, so the pace gate never holds the
      // countdown back.
      speed: 90,
      sessionTime,
      isOnTrack: true,
      onPitRoad: false,
      isReplayPlaying: false,
    } as TrackStateSnapshot);
  };
};

const renderCue = () =>
  render(
    <BrakeCue
      cuePointsM={CUE_POINTS_M}
      showBars
      barSide="right"
      lastBar="top"
      playAudio={false}
      volume={0.6}
      audioCueLeadSec={0}
      colors={DEFAULT_LAP_TRACE_COLORS}
    />
  );

const nextFrames = (count: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) =>
      left === 0 ? resolve() : setTimeout(() => step(left - 1), 20);
    step(count);
  });

describe('useBrakeCue', () => {
  beforeEach(() => {
    useLapTraceStore.getState().reset();
    const record = makeSyntheticLapTrace({ trackLengthM: TRACK_LENGTH_M });
    useLapTraceStore.setState({
      trackLengthM: TRACK_LENGTH_M,
      referenceLap: hydrateLapTrace(record),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'channelBridge');
    useLapTraceStore.getState().reset();
  });

  it('counts down from the snapshots it is sent', async () => {
    const moveTo = trackStateBridge();
    const { getByTestId } = renderCue();
    const strip = getByTestId('brake-cue-bars');

    // The first usable snapshot only seeds the latch. Snapshots arrive 40 ms
    // apart, each with a frame of its own.
    act(() => moveTo(880));
    await nextFrames(2);
    act(() => moveTo(900));

    await waitFor(() => expect(strip.style.visibility).toBe('visible'));
  });

  it('asks for no frames between snapshots', async () => {
    const moveTo = trackStateBridge();
    renderCue();
    act(() => moveTo(880));
    await nextFrames(2);

    const raf = vi.spyOn(window, 'requestAnimationFrame');
    await nextFrames(10);
    expect(raf).not.toHaveBeenCalled();

    act(() => moveTo(890));
    expect(raf).toHaveBeenCalledTimes(1);
  });
});
