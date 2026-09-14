import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChannelBridge, TrackStateSnapshot } from '@irdashies/types';
import { useLapTraceStore, useSessionStore } from '@irdashies/context';
import { hydrateLapTrace } from '../../domain/lapTrace/hydrateLapTrace';
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

  it('places the brake countdown bars beside the trace, not over it', () => {
    seedReference();

    const { container } = render(
      <LapTrace {...baseProps} brakeCueBars brakeCueBarSide="right" />
    );

    const strip = screen.getByTestId('brake-cue-bars');
    expect(strip).toBeTruthy();
    // A sibling of the plot column rather than an overlay on top of it.
    expect(strip.className).not.toContain('absolute');
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('leaves the countdown out entirely when both cue outputs are off', () => {
    seedReference();

    render(<LapTrace {...baseProps} />);

    expect(screen.queryByTestId('brake-cue-bars')).toBeNull();
  });

  it.each(['bottom', 'top', 'left', 'right'] as const)(
    'places the last-corner panel on the %s edge',
    (position) => {
      seedReference();

      render(
        <LapTrace
          {...baseProps}
          showLastCorner
          lastCornerPosition={position}
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
        showLastCorner
        lastCornerPosition="right"
        brakeCueBars
        brakeCueBarSide="right"
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
        showLastCorner
        lastCornerPosition="right"
        brakeCueBars
        brakeCueBarSide="bottom"
      />
    );

    const strip = screen.getByTestId('brake-cue-bars');
    const panel = screen.getByTestId('last-corner-panel');
    const svg = document.querySelector('svg');
    const plotColumn = strip.parentElement;

    // The horizontal strip shares the plot's column, so it spans only the
    // trace width — and that column excludes the side history panel, which
    // takes its own width from the row alongside the column.
    expect(svg).toBeTruthy();
    expect(plotColumn?.contains(svg ?? null)).toBe(true);
    expect(plotColumn?.contains(panel)).toBe(false);
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
