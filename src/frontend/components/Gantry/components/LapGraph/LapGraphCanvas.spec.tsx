import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LapGraphCanvas } from './LapGraphCanvas';
import type { LapGraphSeries } from './LapGraphCanvas';

interface FakeContext {
  strokes: number;
  clears: number;
  fills: number;
}

const contexts = new Map<string, FakeContext>();

const createFakeContext = (record: FakeContext) =>
  ({
    setTransform: vi.fn(),
    clearRect: vi.fn(() => {
      record.clears++;
    }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(() => {
      record.strokes++;
    }),
    fill: vi.fn(() => {
      record.fills++;
    }),
    save: vi.fn(),
    restore: vi.fn(),
    globalAlpha: 1,
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    lineJoin: 'round',
    lineCap: 'round',
  }) as unknown as CanvasRenderingContext2D;

const PLOT_WIDTH = 800;
const PLOT_HEIGHT = 400;

const field: LapGraphSeries[] = Array.from({ length: 60 }, (_, carIdx) => ({
  carIdx,
  carNumber: String(carIdx + 1),
  displayName: `Driver ${carIdx + 1}`,
  isPlayer: carIdx === 3,
  color: '#22c55e',
  points: Array.from({ length: 200 }, (_, i) => ({
    lap: i + 1,
    value: carIdx * 0.5 + i * 0.05,
  })),
}));

const contextFor = (testId: string): FakeContext => {
  const record = contexts.get(testId);
  if (!record) throw new Error(`No context recorded for ${testId}`);
  return record;
};

beforeEach(() => {
  contexts.clear();

  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {
        /* sizes come from the stubbed bounding box */
      }
      unobserve() {
        /* no-op */
      }
      disconnect() {
        /* no-op */
      }
    }
  );

  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: PLOT_WIDTH,
    bottom: PLOT_HEIGHT,
    width: PLOT_WIDTH,
    height: PLOT_HEIGHT,
    toJSON: () => ({}),
  } as DOMRect);

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement) {
      const key = this.getAttribute('data-testid') ?? 'unknown';
      let record = contexts.get(key);
      if (!record) {
        record = { strokes: 0, clears: 0, fills: 0 };
        contexts.set(key, record);
      }
      const held = this as HTMLCanvasElement & {
        fakeContext?: CanvasRenderingContext2D;
      };
      held.fakeContext ??= createFakeContext(record);
      return held.fakeContext;
    } as never
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const renderChart = (props?: Partial<Parameters<typeof LapGraphCanvas>[0]>) =>
  render(
    <LapGraphCanvas
      series={field}
      mode="trace"
      axisCaption="seconds vs reference pace, higher is better"
      pinnedCarIdxs={[1, 2]}
      focusedCarIdx={null}
      onTogglePin={vi.fn()}
      {...props}
    />
  );

describe('LapGraphCanvas', () => {
  it('draws the whole field on the base canvas', async () => {
    renderChart();

    await waitFor(() => expect(contextFor('lap-graph-base').strokes).toBe(60));
  });

  it('redraws only the overlay while the pointer moves', async () => {
    renderChart();
    await waitFor(() => expect(contextFor('lap-graph-base').strokes).toBe(60));

    const base = contextFor('lap-graph-base');
    const plot = screen.getByLabelText('Lap graph plot');
    const baseStrokesBefore = base.strokes;
    const baseClearsBefore = base.clears;

    const moves = 25;
    for (let i = 0; i < moves; i++) {
      fireEvent.pointerMove(plot, {
        clientX: 20 + i * 25,
        clientY: 40 + (i % 7) * 30,
      });
    }

    // The single most important property: the base canvas is untouched.
    expect(base.strokes).toBe(baseStrokesBefore);
    expect(base.clears).toBe(baseClearsBefore);

    const overlay = contextFor('lap-graph-overlay');
    expect(overlay.clears).toBeGreaterThanOrEqual(moves);
    // Crosshair plus at most one hovered line, whatever the field size.
    expect(overlay.strokes).toBeLessThanOrEqual(moves * 2);
  });

  it('leaving the plot clears the overlay without redrawing the base', async () => {
    renderChart();
    await waitFor(() => expect(contextFor('lap-graph-base').strokes).toBe(60));

    const base = contextFor('lap-graph-base');
    const plot = screen.getByLabelText('Lap graph plot');
    fireEvent.pointerMove(plot, { clientX: 400, clientY: 200 });
    const baseStrokes = base.strokes;

    fireEvent.pointerLeave(plot);

    expect(base.strokes).toBe(baseStrokes);
  });

  it('redraws the base when the mode changes', async () => {
    const { rerender } = renderChart();
    await waitFor(() => expect(contextFor('lap-graph-base').strokes).toBe(60));

    rerender(
      <LapGraphCanvas
        series={field}
        mode="position"
        axisCaption="class position, 1 at the top"
        pinnedCarIdxs={[1, 2]}
        focusedCarIdx={null}
        onTogglePin={vi.fn()}
      />
    );

    await waitFor(() => expect(contextFor('lap-graph-base').strokes).toBe(120));
  });

  it('draws the overview strip on its own canvas', async () => {
    renderChart();

    await waitFor(() => expect(contextFor('lap-graph-brush').strokes).toBe(60));
  });

  it('keeps the caption and controls in the DOM rather than the canvas', async () => {
    renderChart();

    await waitFor(() =>
      expect(
        screen.getByText('seconds vs reference pace, higher is better')
      ).toBeInTheDocument()
    );
    expect(
      screen.getByRole('button', { name: /follow live/i })
    ).toBeInTheDocument();
  });

  it('steps the lap window with the arrow keys', async () => {
    renderChart();
    await waitFor(() => expect(contextFor('lap-graph-base').strokes).toBe(60));

    const plot = screen.getByLabelText('Lap graph plot');
    expect(screen.getByText('Laps 125-200')).toBeInTheDocument();

    fireEvent.keyDown(plot, { key: 'ArrowLeft' });

    await waitFor(() =>
      expect(screen.getByText('Laps 124-199')).toBeInTheDocument()
    );
    // Panning off the newest lap disarms Follow live.
    expect(
      screen.getByRole('button', { name: /follow live/i })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders an empty state without drawing', () => {
    renderChart({ series: [] });

    expect(screen.getByText('Waiting for lap data.')).toBeInTheDocument();
  });
});
