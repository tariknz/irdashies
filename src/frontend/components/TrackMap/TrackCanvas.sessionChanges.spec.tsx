import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResetOnDisconnect, useSessionStore } from '@irdashies/context';
import type { Session } from '@irdashies/types';
import { TrackCanvas } from './TrackCanvas';
import { useTrackId } from './hooks/useTrackId';
import { loadTrackDrawing } from '@irdashies/domain/track/trackDrawingLoader';
import type { TrackDrawing } from '@irdashies/domain/track';

vi.mock('@irdashies/domain/track/trackDrawingLoader', () => ({
  loadTrackDrawing: vi.fn(),
}));
vi.mock('@irdashies/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@irdashies/context')>()),
  useTrackStateSnapshot: () => null,
  useCarIdxOffTrack: () => [],
}));
vi.mock('@irdashies/utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn() },
}));

const drawing = (path: string): TrackDrawing => ({
  active: {
    inside: path,
    outside: '',
    trackPathPoints: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    totalLength: 100,
  },
  startFinish: {
    line: 'M0 0L0 10',
    point: { x: 0, y: 0, length: 0 },
    direction: 'clockwise',
  },
});
const firstDrawing = drawing('M0 0L100 0L100 100Z');
const secondDrawing = drawing('M0 0L50 100L100 0Z');
const thirdDrawing = drawing('M0 0L200 0L200 100Z');

const deferred = () => {
  let resolve!: (value: TrackDrawing | null) => void;
  const promise = new Promise<TrackDrawing | null>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

// Only the session identity and track are consumed by this map boundary.
const changeSession = (trackId: number, sessionId = trackId) =>
  act(() => {
    useSessionStore.getState().setSession({
      WeekendInfo: { TrackID: trackId, SubSessionID: sessionId },
    } as Session);
  });

const SessionMap = ({ running = true }: { running?: boolean }) => {
  useResetOnDisconnect(running);
  const trackId = useTrackId();
  return trackId === undefined ? null : (
    <TrackCanvas trackId={trackId} drivers={[]} />
  );
};

class DrawingPath {
  constructor(readonly source: string) {}
}

const context = {
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  translate: vi.fn(),
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn<(path?: Path2D) => void>(),
};
const observerDisconnected = vi.fn();
const paintedPaths = () =>
  context.stroke.mock.calls.flatMap(([path]) =>
    path instanceof DrawingPath ? [path.source] : []
  );

beforeEach(() => {
  vi.clearAllMocks();
  useSessionStore.getState().resetSession();
  vi.stubGlobal('Path2D', DrawingPath);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = observerDisconnected;
    }
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(360);
});
afterEach(() => {
  cleanup();
  useSessionStore.getState().resetSession();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('session-driven track canvas', () => {
  it('clears the previous canvas while another session loads and paints the new track', async () => {
    const next = deferred();
    vi.mocked(loadTrackDrawing)
      .mockResolvedValueOnce(firstDrawing)
      .mockReturnValueOnce(next.promise);
    changeSession(1);
    const { container } = render(<SessionMap />);
    await waitFor(() =>
      expect(paintedPaths()).toContain(firstDrawing.active.inside)
    );
    const oldCanvas = container.querySelector('canvas');

    changeSession(337);
    expect(container.querySelector('canvas')).toBeNull();
    expect(oldCanvas?.isConnected).toBe(false);
    expect(observerDisconnected).toHaveBeenCalled();
    await act(async () => next.resolve(secondDrawing));

    const newCanvas = container.querySelector('canvas');
    expect(newCanvas).not.toBe(oldCanvas);
    expect(newCanvas?.width).toBe(640);
    expect(newCanvas?.height).toBe(360);
    expect(paintedPaths()).toContain(secondDrawing.active.inside);
    expect(context.drawImage).toHaveBeenCalled();
  });

  it('keeps the canvas and drawing when a new session uses the same track', async () => {
    vi.mocked(loadTrackDrawing).mockResolvedValue(firstDrawing);
    changeSession(1, 100);
    const { container } = render(<SessionMap />);
    await waitFor(() =>
      expect(container.querySelector('canvas')).not.toBeNull()
    );
    const canvas = container.querySelector('canvas');
    changeSession(1, 101);
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(loadTrackDrawing).toHaveBeenCalledTimes(1);
    expect(observerDisconnected).not.toHaveBeenCalled();
  });

  it('never paints a late drawing after a faster subsequent session has loaded', async () => {
    const slow = deferred();
    vi.mocked(loadTrackDrawing)
      .mockResolvedValueOnce(firstDrawing)
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(thirdDrawing);
    changeSession(1);
    const { container } = render(<SessionMap />);
    await waitFor(() =>
      expect(container.querySelector('canvas')).not.toBeNull()
    );
    changeSession(337);
    changeSession(5);
    await waitFor(() =>
      expect(paintedPaths()).toContain(thirdDrawing.active.inside)
    );
    const canvas = container.querySelector('canvas');
    context.stroke.mockClear();
    await act(async () => slow.resolve(secondDrawing));
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(paintedPaths()).not.toContain(secondDrawing.active.inside);
  });

  it('honors the disconnect reset and ignores an in-flight drawing before reconnecting', async () => {
    const slow = deferred();
    vi.mocked(loadTrackDrawing)
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(secondDrawing);
    changeSession(1);
    const { container, rerender } = render(<SessionMap running />);
    rerender(<SessionMap running={false} />);
    expect(useSessionStore.getState().session).toBeNull();
    await act(async () => slow.resolve(firstDrawing));
    expect(container.querySelector('canvas')).toBeNull();
    expect(paintedPaths()).not.toContain(firstDrawing.active.inside);

    rerender(<SessionMap running />);
    changeSession(337);
    await waitFor(() =>
      expect(paintedPaths()).toContain(secondDrawing.active.inside)
    );
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('hides an unsupported track and recovers when a supported session arrives', async () => {
    vi.mocked(loadTrackDrawing)
      .mockResolvedValueOnce(firstDrawing)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(secondDrawing);
    changeSession(1);
    const { container } = render(<SessionMap />);
    await waitFor(() =>
      expect(container.querySelector('canvas')).not.toBeNull()
    );
    changeSession(999999);
    await act(async () => undefined);
    expect(container.querySelector('canvas')).toBeNull();
    changeSession(337);
    await waitFor(() =>
      expect(paintedPaths()).toContain(secondDrawing.active.inside)
    );
  });
});
