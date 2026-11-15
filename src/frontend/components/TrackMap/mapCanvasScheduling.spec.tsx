import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WidgetScale } from '@irdashies/domain/widgetPresentation/WidgetScale';
import {
  TrackCanvas,
  type TrackDrawing,
  type TrackDriver,
} from './TrackCanvas';
import { FlatTrackMapCanvas } from './FlatTrackMapCanvas';

const drawing: TrackDrawing = {
  active: {
    inside: 'M0 0L100 0',
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
};
const pitState: readonly boolean[] = [];
const offTrack: boolean[] = [];
const turnLabels = {
  enabled: false,
  labelType: 'both',
  highContrast: true,
  labelFontSize: 100,
} as const;

vi.mock('@irdashies/domain/track', () => ({ useTrackDrawing: () => drawing }));
vi.mock('@irdashies/context', () => ({
  useTrackStateSnapshot: () => ({ carIdxOnPitRoad: pitState }),
  useCarIdxOffTrack: () => offTrack,
}));

const drivers = (progress: number): TrackDriver[] => [
  {
    driver: {
      CarIdx: 7,
      CarNumber: '7',
      CarClassID: 1,
      CarClassColor: 0xff0000,
    } as TrackDriver['driver'],
    progress,
    isPlayer: true,
  },
];
let contexts: WeakMap<HTMLCanvasElement, string[]>;
let callbacks: Map<number, FrameRequestCallback>;
let resizeCallbacks: (() => void)[];
let width: number;
let now: number;
const events = (canvas: HTMLCanvasElement | null) =>
  canvas ? (contexts.get(canvas) ?? []) : [];
const frame = (time: number) => {
  now = time;
  const pending = [...callbacks.values()];
  callbacks.clear();
  act(() => pending.forEach((callback) => callback(time)));
};

beforeEach(() => {
  vi.useFakeTimers();
  contexts = new WeakMap();
  callbacks = new Map();
  resizeCallbacks = [];
  width = 640;
  now = 0;
  let frameId = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  vi.stubGlobal(
    'Path2D',
    class {
      constructor(readonly path: string) {}
    }
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback);
      }
      observe() {
        /* No automatic observation in jsdom. */
      }
      disconnect() {
        /* No native observer to release. */
      }
    }
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
    () => width
  );
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(360);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement) {
      let log = contexts.get(this);
      if (!log) {
        log = [];
        contexts.set(this, log);
      }
      const canvasEvents = log;
      return new Proxy(
        {
          clearRect: () => canvasEvents.push('clear'),
          drawImage: () => canvasEvents.push('static'),
          fillText: (text: string) => canvasEvents.push(`text:${text}`),
          measureText: () => ({
            actualBoundingBoxAscent: 8,
            actualBoundingBoxDescent: 2,
          }),
        },
        { get: (target, key) => Reflect.get(target, key) ?? (() => undefined) }
      ) as unknown as CanvasRenderingContext2D;
    }
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('coalesces positional commits when turn labels are omitted', () => {
  const view = render(
    <TrackCanvas trackId={1} drivers={drivers(0.1)} maxFps={30} />
  );
  const canvas = view.container.querySelector('canvas');
  expect(events(canvas).at(-1)).toBe('text:7');
  events(canvas).length = 0;

  now = 10;
  view.rerender(<TrackCanvas trackId={1} drivers={drivers(0.3)} maxFps={30} />);
  expect(events(canvas)).toEqual([]);
  expect(callbacks.size).toBe(1);
  now = 20;
  view.rerender(<TrackCanvas trackId={1} drivers={drivers(0.5)} maxFps={30} />);
  expect(events(canvas)).toEqual([]);
  expect(callbacks.size).toBe(1);

  frame(32);
  expect(events(canvas)).toEqual([]);
  expect(callbacks.size).toBe(1);
  frame(40);
  expect(events(canvas).filter((event) => event === 'text:7')).toHaveLength(1);
  expect(callbacks.size).toBe(0);
});

describe.each(['track', 'flat', 'both'] as const)(
  '%s canvas scheduling',
  (kind) => {
    const Harness = ({
      source,
      scale = 100,
      inverted = false,
    }: {
      source: TrackDriver[];
      scale?: number;
      inverted?: boolean;
    }) => (
      <WidgetScale scale={scale}>
        {kind !== 'flat' && (
          <TrackCanvas
            trackId={1}
            drivers={source}
            turnLabels={turnLabels}
            invertTrackColors={inverted}
            maxFps={30}
          />
        )}
        {kind !== 'track' && (
          <FlatTrackMapCanvas
            trackDrawing={drawing}
            drivers={source}
            invertTrackColors={inverted}
            maxFps={30}
          />
        )}
      </WidgetScale>
    );

    it('coalesces snapshots independently and restores drivers after resize/scale while idle', () => {
      let source = drivers(0.1);
      const view = render(<Harness source={source} />);
      const canvases = [...view.container.querySelectorAll('canvas')];
      expect(canvases).toHaveLength(kind === 'both' ? 2 : 1);
      for (const canvas of canvases) {
        expect(events(canvas).at(-1)).toBe('text:7');
        events(canvas).length = 0;
      }
      source = drivers(0.3);
      view.rerender(<Harness source={source} />);
      expect(callbacks.size).toBe(canvases.length);
      for (const canvas of canvases) expect(events(canvas)).toEqual([]);
      frame(40);
      expect(callbacks.size).toBe(0);
      for (const canvas of canvases) {
        expect(events(canvas).at(-1)).toBe('text:7');
        events(canvas).length = 0;
      }

      width = 720;
      act(() => {
        resizeCallbacks.forEach((callback) => callback());
        vi.advanceTimersByTime(50);
      });
      for (const canvas of canvases) {
        expect(canvas.width).toBe(720);
        expect(events(canvas).at(-1)).toBe('text:7');
      }
      // Scaling clears the backing store even at the same logical dimensions.
      for (const canvas of canvases) events(canvas).length = 0;
      view.rerender(<Harness source={source} scale={150} />);
      for (const canvas of canvases) {
        expect(canvas.width).toBe(1080);
        expect(events(canvas).at(-1)).toBe('text:7');
      }
      expect(callbacks.size).toBe(0);
    });

    it('restores appearance changes in the commit, including a static rebuild with new targets', () => {
      const source = drivers(0.1);
      const view = render(<Harness source={source} />);
      for (const canvas of view.container.querySelectorAll('canvas'))
        events(canvas).length = 0;
      view.rerender(<Harness source={source} inverted />);
      for (const canvas of view.container.querySelectorAll('canvas'))
        expect(events(canvas).at(-1)).toBe('text:7');
      for (const canvas of view.container.querySelectorAll('canvas'))
        events(canvas).length = 0;
      view.rerender(<Harness source={drivers(0.3)} />);
      if (kind !== 'flat') {
        // TrackCanvas's static-cache effect erases the cars in this same commit.
        expect(events(view.container.querySelector('canvas')).at(-1)).toBe(
          'text:7'
        );
      }
      frame(40);
      for (const canvas of view.container.querySelectorAll('canvas'))
        expect(events(canvas).at(-1)).toBe('text:7');
      view.unmount();
      expect(callbacks.size).toBe(0);
    });
  }
);
