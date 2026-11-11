import { Profiler } from 'react';
import { act, render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  ChannelBridge,
  LapTraceSampleSnapshot,
  LayoutNode,
  Session,
  TrackStateSnapshot,
} from '@irdashies/types';
import { useLapTraceStore, useSessionStore } from '@irdashies/context';
import { hydrateLapTrace } from '../../domain/lapTrace/hydrateLapTrace';
import { lapTraceTreeFromLegacy } from '@irdashies/types';
import { LapTrace } from './LapTrace';
import { makeSyntheticLapTrace } from './fixtures/syntheticLap';

vi.mock('@irdashies/utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// The widget reads its config from the dashboard context; these tests drive it
// through props instead, which take precedence over the stored settings.
vi.mock('./hooks/useLapTraceSettings', async () => {
  const { getWidgetDefaultConfig } =
    await vi.importActual<typeof import('@irdashies/types')>(
      '@irdashies/types'
    );
  const defaults = getWidgetDefaultConfig('laptrace');
  return { useLapTraceSettings: () => defaults };
});

const TRACK_LENGTH_M = 5000;

const trackState = (
  overrides: Partial<TrackStateSnapshot> = {}
): TrackStateSnapshot =>
  ({
    focusCarIdx: 0,
    carIdxLapDistPct: [0.2],
    carIdxOnPitRoad: [false],
    carIdxTrackSurface: [3],
    carIdxClassPosition: [1],
    carLeftRight: 0,
    isOnTrack: true,
    playerCarInPitStall: false,
    playerTrackSurface: 3,
    onPitRoad: false,
    isInGarage: false,
    isGarageVisible: false,
    isReplayPlaying: false,
    sessionTime: 10,
    sessionState: 4,
    sessionFlags: 0,
    speed: 50,
    displayUnits: 1,
    pitSpeedLimiterToggle: false,
    pitstopActive: false,
    engineWarnings: 0,
    lapDistPct: 0.2,
    sessionNum: 0,
    version: 1,
    ...overrides,
  }) as TrackStateSnapshot;

const seedReference = () => {
  const record = makeSyntheticLapTrace({ trackLengthM: TRACK_LENGTH_M });
  useLapTraceStore.setState({
    trackId: record.trackId,
    trackConfigName: record.trackConfigName,
    carPath: record.carPath,
    trackLengthM: record.trackLengthM,
    referenceLap: hydrateLapTrace(record),
    referenceError: null,
  });
};

/**
 * Drive the real recorder far enough to produce a reason, so these tests
 * exercise the same path the overlay does rather than a hand-built lap.
 */
const seedLap = async (
  frames: Partial<LapTraceSampleSnapshot>[]
): Promise<void> => {
  const store = useLapTraceStore.getState();
  await store.initialize(undefined, 1, 'Grand Prix', 'testcar', TRACK_LENGTH_M);
  let version = 0;
  for (const frame of frames) {
    useLapTraceStore.getState().collectPlayerFrame(undefined, {
      sessionTime: 0,
      lapDistPct: 0,
      throttle: 0,
      brake: 0,
      speed: 40,
      gear: 3,
      brakeAbsActive: false,
      onPitRoad: false,
      isOnTrack: true,
      sessionNum: 0,
      lastLapTime: 0,
      lapCompleted: 0,
      incidentCount: 0,
      simLapInvalidated: false,
      ...frame,
      version: ++version,
    });
  }
};

const baseProps = {
  metersBehind: 200,
  metersAhead: 200,
  showThrottle: true,
  showBrake: true,
  showSpeed: true,
  showGhost: true,
  showGearLabels: true,
  showBrakePointMarkers: true,
  showThrottlePointMarkers: true,
  referenceFilled: false,
  strokeWidth: 3,
  showOnlyWhenOnTrack: false,
  background: { opacity: 0.7 },
  carDistanceMOverride: 340,
};

describe('LapTrace', () => {
  beforeEach(() => {
    // The widget reads driving state from track-state.snapshot, so without a
    // bridge the channel store throws on an undefined WeakMap key. This is the
    // exact ingredient the Storybook decorators have to supply too.
    window.channelBridge = {
      subscribe: (channel: string, callback: (payload: unknown) => void) => {
        if (channel === 'track-state.snapshot') callback(trackState());
        return () => undefined;
      },
    } as unknown as ChannelBridge;
    useLapTraceStore.getState().reset();
    useSessionStore.getState().resetSession();
  });

  afterEach(() => {
    cleanup();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).channelBridge;
    useLapTraceStore.getState().reset();
    useSessionStore.getState().resetSession();
  });

  it('renders the trace once a reference lap is loaded', () => {
    seedReference();

    const { container } = render(<LapTrace {...baseProps} />);

    expect(container.querySelector('svg')).toBeTruthy();
    expect(screen.getByTestId('gear-labels')).toBeTruthy();
  });

  it('prompts for a clean lap before a reference exists', () => {
    useLapTraceStore.setState({
      trackLengthM: TRACK_LENGTH_M,
      referenceLap: null,
    });

    render(<LapTrace {...baseProps} />);

    expect(
      screen.getByText(/Drive a clean lap to record a reference/i)
    ).toBeTruthy();
  });

  it('replaces the recording bar with the reason the lap cannot count', async () => {
    // Out of the garage: the lap was never going to be recorded, and a bar
    // filling towards a reference that will never be saved says the opposite.
    await seedLap([{ lapDistPct: 0, onPitRoad: true }]);

    render(<LapTrace {...baseProps} />);

    expect(screen.getByText(/Out-lap/i)).toBeTruthy();
    expect(screen.queryByText(/Recording \d+%/)).toBeNull();
  });

  it('names an incident as the cause', async () => {
    await seedLap([
      { lapDistPct: 0, sessionTime: 0, incidentCount: 0 },
      { lapDistPct: 0.005, sessionTime: 1, incidentCount: 1 },
    ]);

    render(<LapTrace {...baseProps} />);

    expect(screen.getByText(/Incident/i)).toBeTruthy();
  });

  it("reports LMU's bare void flag without inventing a cause", async () => {
    // No incident count anywhere -- the LMU shape.
    await seedLap([
      { lapDistPct: 0, sessionTime: 0 },
      { lapDistPct: 0.005, sessionTime: 1, simLapInvalidated: true },
    ]);

    render(<LapTrace {...baseProps} />);

    expect(screen.getByText('Lap invalidated by the sim')).toBeTruthy();
  });

  it('shows the recording bar while the lap is still a candidate', async () => {
    await seedLap([
      { lapDistPct: 0, sessionTime: 0 },
      { lapDistPct: 0.005, sessionTime: 1 },
    ]);

    render(<LapTrace {...baseProps} />);

    expect(screen.getByText(/Recording \d+%/)).toBeTruthy();
  });

  it('keeps a failed reference load ahead of a scruffy lap', async () => {
    await seedLap([{ lapDistPct: 0, onPitRoad: true }]);
    useLapTraceStore.setState({ referenceError: 'No lap imported' });

    render(<LapTrace {...baseProps} />);

    expect(screen.getByText('No lap imported')).toBeTruthy();
    expect(screen.queryByText(/Out-lap/i)).toBeNull();
  });

  describe('as the lap in progress advances', () => {
    /** More frames of the lap seedLap started, from `fromPct` on. */
    const drive = (fromPct: number, frames: number) => {
      for (let i = 1; i <= frames; i++) {
        const lapDistPct = fromPct + i * 0.002;
        useLapTraceStore.getState().collectPlayerFrame(undefined, {
          sessionTime: lapDistPct * 100,
          lapDistPct,
          throttle: 1,
          brake: 0,
          speed: 50,
          gear: 3,
          brakeAbsActive: false,
          onPitRoad: false,
          isOnTrack: true,
          sessionNum: 0,
          lastLapTime: 0,
          lapCompleted: 0,
          incidentCount: 0,
          simLapInvalidated: false,
          version: 1000 + i,
        });
      }
    };

    it('does not re-render the widget once a reference is loaded', async () => {
      await seedLap([{ lapDistPct: 0, sessionTime: 0 }]);
      seedReference();
      const onRender = vi.fn();
      render(
        <Profiler id="laptrace" onRender={onRender}>
          <LapTrace {...baseProps} />
        </Profiler>
      );
      onRender.mockClear();

      // 100 m of lap, published to the store every 5 m.
      act(() => drive(0, 10));

      expect(onRender).not.toHaveBeenCalled();
    });

    it('still counts the recording up before there is one', async () => {
      await seedLap([{ lapDistPct: 0, sessionTime: 0 }]);
      render(<LapTrace {...baseProps} />);
      expect(screen.getByText('Recording 0%')).toBeTruthy();

      act(() => drive(0, 10));

      expect(screen.getByText('Recording 2%')).toBeTruthy();
    });
  });

  it('says nothing about the lap in progress once a reference is loaded', async () => {
    await seedLap([{ lapDistPct: 0, onPitRoad: true }]);
    seedReference();

    render(<LapTrace {...baseProps} />);

    expect(screen.queryByText(/Out-lap/i)).toBeNull();
  });

  it('places the brake countdown bars beside the trace, not over it', () => {
    seedReference();

    const { container } = render(
      <LapTrace
        {...baseProps}
        layoutTree={lapTraceTreeFromLegacy({
          brakeCueBars: true,
          brakeCueBarSide: 'right',
        })}
      />
    );

    const strip = screen.getByTestId('brake-cue-bars');
    expect(strip).toBeTruthy();
    // A sibling of the plot column rather than an overlay on top of it.
    expect(strip.className).not.toContain('absolute');
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('leaves the countdown out entirely when both cue outputs are off', () => {
    seedReference();

    // The default layout holds the bars; the audio is off by default.
    render(<LapTrace {...baseProps} layoutTree={lapTraceTreeFromLegacy({})} />);

    expect(screen.queryByTestId('brake-cue-bars')).toBeNull();
  });

  it.each(['bottom', 'top', 'left', 'right'] as const)(
    'places the last-corner panel on the %s edge',
    (position) => {
      seedReference();

      render(
        <LapTrace
          {...baseProps}
          layoutTree={lapTraceTreeFromLegacy({
            showLastCorner: true,
            lastCornerPosition: position,
          })}
          lastCornerCount={3}
        />
      );

      const panel = screen.getByTestId('last-corner-panel');
      expect(panel.dataset.placement).toBe(position);
      // Every placement stacks one line per corner.
      expect(panel.className).toContain('flex-col');
    }
  );

  it('keeps its content inside the layout rectangle', () => {
    seedReference();

    const { container } = render(<LapTrace {...baseProps} />);

    // Resizing the widget shorter than its fixed-height rows used to push the
    // trace outside its own box in edit mode.
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('overflow-hidden');
  });

  it('keeps the gear labels in a row beneath the trace, not over it', () => {
    seedReference();

    render(<LapTrace {...baseProps} showGearLabels />);

    const labels = screen.getByTestId('gear-labels');
    const svg = document.querySelector('svg');
    // A sibling row rather than an overlay, so a short widget shrinks the trace
    // instead of sliding the labels up into it.
    expect(labels.contains(svg)).toBe(false);
    expect(svg?.parentElement?.contains(labels)).toBe(false);
    expect(labels.className).toContain('flex-none');
  });

  it('puts a side panel outside the brake countdown bars', () => {
    seedReference();

    const { container } = render(
      <LapTrace
        {...baseProps}
        layoutTree={lapTraceTreeFromLegacy({
          showLastCorner: true,
          lastCornerPosition: 'right',
          brakeCueBars: true,
          brakeCueBarSide: 'right',
        })}
      />
    );

    const panel = screen.getByTestId('last-corner-panel');
    const bars = screen.getByTestId('brake-cue-bars');
    // The bars are a live cue tied to the trace, so they stay closest to it.
    expect(
      bars.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('keeps a top/bottom brake strip within the plot column, not the widget width', () => {
    seedReference();

    render(
      <LapTrace
        {...baseProps}
        layoutTree={lapTraceTreeFromLegacy({
          showLastCorner: true,
          lastCornerPosition: 'right',
          brakeCueBars: true,
          brakeCueBarSide: 'bottom',
        })}
      />
    );

    const strip = screen.getByTestId('brake-cue-bars');
    const panel = screen.getByTestId('last-corner-panel');
    const svg = document.querySelector('svg');
    // The innermost container the strip shares with the plot.
    let plotColumn = strip.parentElement;
    while (plotColumn && !plotColumn.contains(svg)) {
      plotColumn = plotColumn.parentElement;
    }

    // The horizontal strip shares the plot's column, so it spans only the
    // trace width — and that column excludes the side history panel, which
    // takes its own width from the row alongside the column.
    expect(svg).toBeTruthy();
    expect(plotColumn?.className).toContain('flex-col');
    expect(plotColumn?.contains(panel)).toBe(false);
  });

  describe('with a layout from the editor', () => {
    const box = (widget: string): LayoutNode => ({
      id: `box-${widget}`,
      type: 'box',
      direction: 'col',
      widgets: [widget],
    });
    const split = (
      direction: 'row' | 'col',
      children: LayoutNode[]
    ): LayoutNode => ({
      id: `split-${direction}-${children.map((c) => c.id).join('-')}`,
      type: 'split',
      direction,
      children,
    });

    it('shows what the layout holds, and only that', () => {
      seedReference();

      const { unmount } = render(
        <LapTrace
          {...baseProps}
          layoutTree={split('row', [
            box('plot'),
            box('brakeCue'),
            box('corners'),
          ])}
        />
      );
      expect(screen.getByTestId('last-corner-panel')).toBeTruthy();
      expect(screen.getByTestId('brake-cue-bars')).toBeTruthy();
      unmount();

      render(
        <LapTrace {...baseProps} layoutTree={split('col', [box('plot')])} />
      );
      expect(screen.queryByTestId('last-corner-panel')).toBeNull();
      expect(screen.queryByTestId('brake-cue-bars')).toBeNull();
      expect(document.querySelector('svg')).toBeTruthy();
    });

    it('says the corners are not available when the track and layout have none', () => {
      const withTrack = (TrackName: string) =>
        useSessionStore.setState({
          session: { WeekendInfo: { TrackName } } as Session,
        });
      const message = () => screen.queryByTestId('last-corner-unavailable');
      const tree = split('row', [box('corners'), box('plot')]);

      // A track the bundled data does not know: said even before the first
      // corner is driven, since no lap will ever bring the corners.
      seedReference();
      withTrack('no such track layout');
      const { unmount } = render(<LapTrace {...baseProps} layoutTree={tree} />);
      expect(message()).toBeTruthy();
      unmount();

      // A known track and layout: the rows, no message.
      withTrack('lagunaseca');
      const { unmount: unmountKnown } = render(
        <LapTrace {...baseProps} layoutTree={tree} />
      );
      expect(screen.getByTestId('last-corner-panel')).toBeTruthy();
      expect(message()).toBeNull();
      unmountKnown();

      // No session yet: nothing is known about the track, so nothing is said.
      useSessionStore.getState().resetSession();
      const { unmount: unmountNoSession } = render(
        <LapTrace {...baseProps} layoutTree={tree} />
      );
      expect(message()).toBeNull();
      unmountNoSession();

      // Not in the layout: no panel, and no message.
      withTrack('no such track layout');
      render(
        <LapTrace {...baseProps} layoutTree={split('col', [box('plot')])} />
      );
      expect(screen.queryByTestId('last-corner-panel')).toBeNull();
      expect(message()).toBeNull();
    });

    it('runs the panel and the strip full height beside the trace, across it above or below', () => {
      seedReference();

      const { unmount } = render(
        <LapTrace
          {...baseProps}
          layoutTree={split('row', [
            box('corners'),
            box('plot'),
            box('brakeCue'),
          ])}
        />
      );
      expect(screen.getByTestId('last-corner-panel').dataset.placement).toBe(
        'left'
      );
      expect(screen.getByTestId('brake-cue-bars').dataset.side).toBe('right');
      unmount();

      render(
        <LapTrace
          {...baseProps}
          layoutTree={split('col', [
            box('brakeCue'),
            box('plot'),
            box('corners'),
          ])}
        />
      );
      expect(screen.getByTestId('last-corner-panel').dataset.placement).toBe(
        'bottom'
      );
      const strip = screen.getByTestId('brake-cue-bars');
      expect(strip.dataset.side).toBe('top');
      expect(strip.className).toContain('w-full');
    });

    it('gives the free room to the branch holding the trace', () => {
      seedReference();

      render(
        <LapTrace
          {...baseProps}
          layoutTree={split('row', [box('plot'), box('corners')])}
        />
      );
      const panelBox = screen.getByTestId('last-corner-panel').parentElement;
      const plotBox = document.querySelector('svg')?.closest('.flex-1');
      expect(panelBox?.className).not.toContain('flex-1');
      expect(plotBox?.contains(panelBox ?? null)).toBe(false);
    });

    it('keeps 40% of a row or 60% of a column for the trace, gives the panel the rest, and never squeezes the countdown', () => {
      seedReference();
      // Whether the layout entry holding the plot keeps this much room.
      const plotKeeps = (minimum: string) => {
        let node = document.querySelector('svg')?.parentElement;
        while (node && !node.classList.contains(minimum)) {
          node = node.parentElement;
        }
        return !!node;
      };

      // Three columns in the default 396px widget: a side panel sized for a
      // long corner name is most of it by itself. Shrinking the countdown
      // with it cut the meter in half, so the panel alone gives way.
      const { unmount } = render(
        <LapTrace
          {...baseProps}
          layoutTree={split('row', [
            box('corners'),
            box('plot'),
            box('brakeCue'),
          ])}
        />
      );
      expect(plotKeeps('min-w-[40%]')).toBe(true);
      // Each sits straight in its box, which the row stretches to full
      // height: the panel and the bars take their height from it.
      const panelBox = screen.getByTestId('last-corner-panel').parentElement;
      expect(panelBox?.className).toContain('flex-initial');
      expect(panelBox?.className).toContain('min-w-0');
      const barsBox = screen.getByTestId('brake-cue-bars').parentElement;
      expect(barsBox?.className).toContain('flex-none');
      expect(barsBox?.className).not.toContain('flex-initial');
      unmount();

      // Above or below, on height, and more of it: the plot's gear and
      // distance labels do not shrink, and at 40% of the default 120px they
      // left the trace itself a few pixels tall.
      const { unmount: unmountStacked } = render(
        <LapTrace
          {...baseProps}
          layoutTree={split('col', [box('plot'), box('corners')])}
        />
      );
      expect(plotKeeps('min-h-[60%]')).toBe(true);
      unmountStacked();

      // Without the trace there is nothing to keep room for.
      const { container } = render(
        <LapTrace
          {...baseProps}
          layoutTree={split('row', [box('corners'), box('brakeCue')])}
        />
      );
      expect(container.querySelector('.flex-initial')).toBeNull();
    });

    it('fills the widget with what is left when the trace is out of the layout', () => {
      seedReference();

      // The countdown alone runs the full height of the widget.
      const { unmount } = render(
        <LapTrace {...baseProps} layoutTree={split('col', [box('brakeCue')])} />
      );
      const barsBox = screen.getByTestId('brake-cue-bars').parentElement;
      expect(barsBox?.className).toContain('flex-1');
      // So does the layout's root, under the header.
      expect(barsBox?.parentElement?.className).toContain('flex-1');
      expect(screen.getByTestId('brake-cue-bars').dataset.side).toBe('right');
      unmount();

      // The panel alone has the whole widget to fit its rows into.
      const { unmount: unmountPanel } = render(
        <LapTrace {...baseProps} layoutTree={split('col', [box('corners')])} />
      );
      const panelBox = screen.getByTestId('last-corner-panel').parentElement;
      expect(panelBox?.className).toContain('flex-1');
      expect(panelBox?.parentElement?.className).toContain('flex-1');
      unmountPanel();

      // Side by side, the panel takes the free room and the bars keep theirs.
      render(
        <LapTrace
          {...baseProps}
          layoutTree={split('row', [box('corners'), box('brakeCue')])}
        />
      );
      expect(
        screen.getByTestId('last-corner-panel').parentElement?.className
      ).toContain('flex-1');
      expect(
        screen.getByTestId('brake-cue-bars').parentElement?.className
      ).toContain('flex-none');
    });

    it('never squeezes the countdown below its width when it shares room with the panel', () => {
      seedReference();
      const entryOf = (testId: string, depth: number) => {
        let node: HTMLElement | null = screen.getByTestId(testId);
        for (let i = 0; i < depth; i += 1) node = node?.parentElement ?? null;
        return node?.className ?? '';
      };

      // Stacked with the panel beside the trace: both are beside it, so the
      // bars run as a column under the panel and take the height it leaves.
      const { unmount } = render(
        <LapTrace
          {...baseProps}
          layoutTree={split('row', [
            box('plot'),
            split('col', [box('corners'), box('brakeCue')]),
          ])}
        />
      );
      expect(screen.getByTestId('brake-cue-bars').dataset.side).toBe('right');
      expect(screen.getByTestId('last-corner-panel').dataset.placement).toBe(
        'right'
      );
      // The column shrinks with the panel, never narrower than the bars.
      const column = entryOf('brake-cue-bars', 2);
      expect(column).toContain('flex-initial');
      expect(column).toContain('min-w-16');
      expect(entryOf('brake-cue-bars', 1)).toContain('flex-1');
      expect(entryOf('last-corner-panel', 1)).toContain('flex-initial');
      unmount();

      // In one box beside the trace, the same rule applies to its entries.
      const shared = (direction: 'row' | 'col'): LayoutNode => ({
        id: `shared-${direction}`,
        type: 'box',
        direction,
        widgets: ['corners', 'brakeCue'],
      });
      const { unmount: unmountColumn } = render(
        <LapTrace
          {...baseProps}
          layoutTree={split('row', [box('plot'), shared('col')])}
        />
      );
      expect(entryOf('brake-cue-bars', 2)).toContain('min-w-16');
      expect(entryOf('brake-cue-bars', 1)).toContain('flex-1');
      unmountColumn();

      render(
        <LapTrace
          {...baseProps}
          layoutTree={split('row', [box('plot'), shared('row')])}
        />
      );
      expect(entryOf('brake-cue-bars', 2)).toContain('min-w-16');
      // Side by side in the box, the bars keep their width and the panel
      // takes what they leave, down to nothing.
      expect(entryOf('brake-cue-bars', 1)).toContain('flex-none');
      expect(entryOf('last-corner-panel', 1)).toContain('flex-1');
      expect(entryOf('last-corner-panel', 1)).toContain('min-w-0');
    });

    it('keeps the strip across the trace from shrinking below its height', () => {
      seedReference();

      render(
        <LapTrace
          {...baseProps}
          layoutTree={split('col', [
            split('row', [box('corners'), box('brakeCue')]),
            box('plot'),
          ])}
        />
      );
      const strip = screen.getByTestId('brake-cue-bars');
      // Above the trace, both run across.
      expect(strip.dataset.side).toBe('top');
      expect(screen.getByTestId('last-corner-panel').dataset.placement).toBe(
        'top'
      );
      // The row of both never goes shorter than the bar across, and the bar
      // takes the row's width.
      expect(strip.parentElement?.parentElement?.className).toContain(
        'min-h-5'
      );
      expect(strip.parentElement?.className).toContain('flex-1');
    });

    it('draws an element the layout holds twice only once', () => {
      seedReference();

      render(
        <LapTrace
          {...baseProps}
          layoutTree={split('row', [
            box('brakeCue'),
            box('plot'),
            split('col', [box('brakeCue'), box('corners')]),
          ])}
        />
      );
      // One countdown, so one telemetry loop and one set of tones.
      expect(screen.getAllByTestId('brake-cue-bars')).toHaveLength(1);
      expect(screen.getByTestId('brake-cue-bars').dataset.side).toBe('left');
      expect(screen.getAllByTestId('last-corner-panel')).toHaveLength(1);
    });

    it('places an element beside the trace that is drawn, not a repeated one', () => {
      seedReference();

      // The repeated trace above the strip is not drawn, so the strip sits
      // beside the first trace: a column of bars, not one across.
      render(
        <LapTrace
          {...baseProps}
          layoutTree={split('row', [
            box('plot'),
            split('col', [box('plot'), box('brakeCue')]),
          ])}
        />
      );
      expect(screen.getAllByTestId('gear-labels')).toHaveLength(1);
      expect(screen.getByTestId('brake-cue-bars').dataset.side).toBe('right');
    });
  });

  it('caps a long imported lap name at half the header', () => {
    const record = makeSyntheticLapTrace({ trackLengthM: TRACK_LENGTH_M });
    const longName =
      'a-very-long-garage-61-export-file-name-that-would-otherwise-run-past-the-widget.csv';
    useLapTraceStore.setState({
      trackId: record.trackId,
      trackLengthM: record.trackLengthM,
      referenceLap: {
        ...hydrateLapTrace(record),
        source: { ...record.source, label: longName },
      },
      referenceError: null,
    });

    render(<LapTrace {...baseProps} />);

    const label = screen.getByText(longName);
    expect(label.className).toContain('truncate');
    expect(label.className).toContain('max-w-[65%]');
  });
});
