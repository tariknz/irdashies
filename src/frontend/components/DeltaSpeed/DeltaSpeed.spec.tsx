import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  DeltaSpeedConfig,
  Session,
  TrackStateSnapshot,
} from '@irdashies/types';
import {
  useGeneralSettings,
  useReferenceLapStore,
  useSessionStore,
} from '@irdashies/context';

// Only useGeneralSettings is faked; it reads through DashboardContext, which
// these tests do not mount. The channel and reference-lap paths stay real so
// the widget is still exercised through its actual data path.
vi.mock('@irdashies/context', async () => {
  const actual = await vi.importActual('@irdashies/context');
  return { ...actual, useGeneralSettings: vi.fn() };
});
import { DeltaSpeed } from './DeltaSpeed';
import { buildMockSpeedLap, mockSpeedAt } from './mockSpeedLap';
import { seedTrackState } from './mockTrackState';

const PLAYER_CAR_IDX = 3;

const baseConfig: DeltaSpeedConfig = {
  background: { opacity: 80 },
  unit: 'km/h',
  scaleKph: 15,
  scaleMph: 10,
  // Off by default so existing cases measure only what they were written for.
  capKph: 0,
  capMph: 0,
  updateThresholdKph: 0,
  updateThresholdMph: 0,
  showNumber: true,
  showOnlyWhenOnTrack: false,
  sessionVisibility: {
    race: true,
    loneQualify: true,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
};

const lap = buildMockSpeedLap();
/** A point on the lap plus the speed that yields the requested delta. */
const REF_PCT = lap.pointPos[200];
const speedForDelta = (deltaKph: number) =>
  (mockSpeedAt(REF_PCT) + deltaKph) / 3.6;

const seedAll = (
  snapshot: Partial<TrackStateSnapshot>,
  withReference = true
) => {
  useSessionStore.setState({
    session: {
      DriverInfo: {
        DriverCarIdx: PLAYER_CAR_IDX,
        Drivers: [{ CarIdx: PLAYER_CAR_IDX, CarClassID: 10 }],
      },
    } as unknown as Session,
  });
  useReferenceLapStore.setState({
    bestLaps: withReference ? new Map([[PLAYER_CAR_IDX, lap]]) : new Map(),
  });
  seedTrackState(snapshot);
};

describe('DeltaSpeed', () => {
  beforeEach(() => {
    useReferenceLapStore.getState().completeSession();
    useSessionStore.setState({ session: null });
    // No compact mode configured — the default, full-size density.
    vi.mocked(useGeneralSettings).mockReturnValue(undefined);
  });

  it('shows a placeholder when there is no reference lap', () => {
    seedAll({ speed: 50, lapDistPct: REF_PCT, isOnTrack: true }, false);

    render(<DeltaSpeed {...baseConfig} />);

    // Occupying space with an explanation beats vanishing: an empty slot is
    // indistinguishable from a broken widget.
    expect(screen.getByText('No clean lap')).toBeInTheDocument();
    // But no number, which would imply a delta it cannot actually compute.
    expect(screen.queryByText(/^[+-]\d/)).not.toBeInTheDocument();
  });

  it('renders nothing when hidden by session visibility', () => {
    // Placeholder or not, an intentionally hidden widget stays hidden.
    seedAll({ speed: 50, lapDistPct: REF_PCT, isOnTrack: false });

    const { container } = render(
      <DeltaSpeed {...baseConfig} showOnlyWhenOnTrack />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a signed delta in km/h', () => {
    seedAll({
      speed: speedForDelta(4.2),
      lapDistPct: REF_PCT,
      isOnTrack: true,
    });

    render(<DeltaSpeed {...baseConfig} />);
    expect(screen.getByText('+4.2')).toBeInTheDocument();
    expect(screen.getByText('km/h')).toBeInTheDocument();
  });

  it('shows a negative delta when slower', () => {
    seedAll({
      speed: speedForDelta(-6.5),
      lapDistPct: REF_PCT,
      isOnTrack: true,
    });

    render(<DeltaSpeed {...baseConfig} />);
    expect(screen.getByText('-6.5')).toBeInTheDocument();
  });

  it('converts to mph for display while comparing in km/h', () => {
    seedAll({
      speed: speedForDelta(16.09),
      lapDistPct: REF_PCT,
      isOnTrack: true,
    });

    render(<DeltaSpeed {...baseConfig} unit="mph" />);
    // 16.09 km/h === 10.0 mph
    expect(screen.getByText('+10.0')).toBeInTheDocument();
    expect(screen.getByText('mph')).toBeInTheDocument();
  });

  it('follows iRacing display units when set to auto', () => {
    seedAll({
      speed: speedForDelta(16.09),
      lapDistPct: REF_PCT,
      isOnTrack: true,
      displayUnits: 0, // imperial
    });

    render(<DeltaSpeed {...baseConfig} unit="auto" />);
    expect(screen.getByText('mph')).toBeInTheDocument();
  });

  it('hides when off track and showOnlyWhenOnTrack is set', () => {
    seedAll({
      speed: speedForDelta(4.2),
      lapDistPct: REF_PCT,
      isOnTrack: false,
    });

    const { container } = render(
      <DeltaSpeed {...baseConfig} showOnlyWhenOnTrack />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('omits the number when showNumber is off', () => {
    seedAll({
      speed: speedForDelta(4.2),
      lapDistPct: REF_PCT,
      isOnTrack: true,
    });

    render(<DeltaSpeed {...baseConfig} showNumber={false} />);
    expect(screen.queryByText('+4.2')).not.toBeInTheDocument();
  });
});
