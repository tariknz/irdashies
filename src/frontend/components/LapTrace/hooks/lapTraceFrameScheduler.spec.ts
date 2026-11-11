import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLapTraceStore } from '@irdashies/context';
import { scheduleLapTraceFrames } from './lapTraceFrameScheduler';

describe('scheduleLapTraceFrames', () => {
  let callbacks: FrameRequestCallback[];

  /** Run the frames pending now; any they request wait for the next call. */
  const runFrames = () => {
    const pending = callbacks;
    callbacks = [];
    for (const callback of pending) callback(performance.now());
  };

  beforeEach(() => {
    callbacks = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      callbacks = [];
    });
    useLapTraceStore.getState().reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws once at start, then once per burst of requests', () => {
    const draw = vi.fn();
    const scheduler = scheduleLapTraceFrames(
      'lapTraceFrame',
      draw,
      () => false
    );

    runFrames();
    expect(draw).toHaveBeenCalledTimes(1);

    scheduler.request();
    scheduler.request();
    scheduler.request();
    expect(callbacks).toHaveLength(1);
    runFrames();
    expect(draw).toHaveBeenCalledTimes(2);

    scheduler.dispose();
  });

  it('asks for a frame on the store changes it is told to watch', () => {
    const draw = vi.fn();
    const scheduler = scheduleLapTraceFrames(
      'lapTraceFrame',
      draw,
      (state, prev) => state.trackLengthM !== prev.trackLengthM
    );
    runFrames();

    useLapTraceStore.setState({ bestLapLoaded: true });
    expect(callbacks).toHaveLength(0);

    useLapTraceStore.setState({ trackLengthM: 1234 });
    runFrames();
    expect(draw).toHaveBeenCalledTimes(2);

    scheduler.dispose();
  });

  it('lets a frame ask for the next one', () => {
    let frames = 0;
    const scheduler = scheduleLapTraceFrames(
      'lapTraceFrame',
      () => {
        frames += 1;
        if (frames === 1) scheduler.request();
      },
      () => false
    );

    runFrames();
    runFrames();
    expect(frames).toBe(2);

    scheduler.dispose();
  });

  it('draws nothing once disposed', () => {
    const draw = vi.fn();
    const scheduler = scheduleLapTraceFrames('lapTraceFrame', draw, () => true);

    scheduler.dispose();
    runFrames();
    scheduler.request();
    useLapTraceStore.setState({ trackLengthM: 99 });
    runFrames();

    expect(draw).not.toHaveBeenCalled();
  });
});
