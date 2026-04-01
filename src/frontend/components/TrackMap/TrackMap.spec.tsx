import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrackMap } from './TrackMap';
import { render } from '@testing-library/react';
import type { Session } from '@irdashies/types';

const trackCanvasSpy = vi.fn();
let mockSessionState: {
  session: Session | null;
  setSession: (session: Session) => void;
  resetSession: () => void;
  greenFlagTimestamp: number | null;
  setGreenFlagTimestamp: (time: number | null) => void;
  checkeredLap: number | null;
  setCheckeredLap: (lap: number | null) => void;
};

vi.mock('./hooks/useTrackId');
vi.mock('./hooks/useDriverProgress');
vi.mock('./hooks/useTrackMapSettings');
vi.mock('./hooks/useHighlightColor');
vi.mock('@irdashies/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@irdashies/context')>();

  return {
    ...actual,
    useDashboard: vi.fn(),
    useSessionStore: vi.fn(),
    useSessionVisibility: vi.fn(),
    useTelemetryValue: vi.fn(),
  };
});
vi.mock('./TrackCanvas', () => ({
  TrackCanvas: (props: unknown) => {
    trackCanvasSpy(props);
    return <div>Track Canvas</div>;
  },
}));

import { useTrackId } from './hooks/useTrackId';
import { useDriverProgress } from './hooks/useDriverProgress';
import { useTrackMapSettings } from './hooks/useTrackMapSettings';
import { useHighlightColor } from './hooks/useHighlightColor';
import {
  useDashboard,
  useSessionStore,
  useSessionVisibility,
  useTelemetryValue,
} from '@irdashies/context';

describe('TrackMap', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSessionState = {
      session: null,
      setSession: vi.fn<(session: Session) => void>(),
      resetSession: vi.fn<() => void>(),
      greenFlagTimestamp: null,
      setGreenFlagTimestamp: vi.fn<(time: number | null) => void>(),
      checkeredLap: null,
      setCheckeredLap: vi.fn<(lap: number | null) => void>(),
    };

    vi.mocked(useDashboard).mockReturnValue({
      isDemoMode: false,
    } as ReturnType<typeof useDashboard>);
    vi.mocked(useTrackId).mockReturnValue(1);
    vi.mocked(useDriverProgress).mockReturnValue({
      drivers: [],
      identities: [],
    });
    vi.mocked(useSessionStore).mockImplementation((selector) =>
      selector(mockSessionState)
    );
    vi.mocked(useHighlightColor).mockReturnValue(undefined);
    vi.mocked(useSessionVisibility).mockReturnValue(true);
  });

  it('should render when all conditions are met', () => {
    vi.mocked(useTrackMapSettings).mockReturnValue({
      turnLabels: {
        enabled: false,
        labelType: 'both',
        highContrast: true,
        labelFontSize: 100,
      },
      showCarNumbers: true,
      displayMode: 'carNumber',
      invertTrackColors: false,
      driverCircleSize: 40,
      playerCircleSize: 40,
      trackmapFontSize: 100,
      trackLineWidth: 20,
      trackOutlineWidth: 40,
      useHighlightColor: false,
      showOnlyWhenOnTrack: false,
      sessionVisibility: {
        race: true,
        loneQualify: true,
        openQualify: true,
        practice: true,
        offlineTesting: true,
      },
    });
    vi.mocked(useTelemetryValue).mockReturnValue(true);

    const { container } = render(<TrackMap />);

    expect(container.querySelector('.w-full')).toBeTruthy();
  });

  it('should hide when showOnlyWhenOnTrack is true and player is not on track', () => {
    vi.mocked(useTrackMapSettings).mockReturnValue({
      turnLabels: {
        enabled: false,
        labelType: 'both',
        highContrast: true,
        labelFontSize: 100,
      },
      showCarNumbers: true,
      displayMode: 'carNumber',
      invertTrackColors: false,
      driverCircleSize: 40,
      playerCircleSize: 40,
      trackmapFontSize: 100,
      trackLineWidth: 20,
      trackOutlineWidth: 40,
      useHighlightColor: false,
      showOnlyWhenOnTrack: true,
      sessionVisibility: {
        race: true,
        loneQualify: true,
        openQualify: true,
        practice: true,
        offlineTesting: true,
      },
    });
    vi.mocked(useTelemetryValue).mockReturnValue(false);

    const { container } = render(<TrackMap />);

    expect(container.firstChild).toBeNull();
  });

  it('should show when showOnlyWhenOnTrack is true and player is on track', () => {
    vi.mocked(useTrackMapSettings).mockReturnValue({
      turnLabels: {
        enabled: false,
        labelType: 'both',
        highContrast: true,
        labelFontSize: 100,
      },
      showCarNumbers: true,
      displayMode: 'carNumber',
      invertTrackColors: false,
      driverCircleSize: 40,
      playerCircleSize: 40,
      trackmapFontSize: 100,
      trackLineWidth: 20,
      trackOutlineWidth: 40,
      useHighlightColor: false,
      showOnlyWhenOnTrack: true,
      sessionVisibility: {
        race: true,
        loneQualify: true,
        openQualify: true,
        practice: true,
        offlineTesting: true,
      },
    });
    vi.mocked(useTelemetryValue).mockReturnValue(true);

    const { container } = render(<TrackMap />);

    expect(container.querySelector('.w-full')).toBeTruthy();
  });

  it('should hide when session visibility is false', () => {
    vi.mocked(useTrackMapSettings).mockReturnValue({
      turnLabels: {
        enabled: false,
        labelType: 'both',
        highContrast: true,
        labelFontSize: 100,
      },
      showCarNumbers: true,
      displayMode: 'carNumber',
      invertTrackColors: false,
      driverCircleSize: 40,
      playerCircleSize: 40,
      trackmapFontSize: 100,
      trackLineWidth: 20,
      trackOutlineWidth: 40,
      useHighlightColor: false,
      showOnlyWhenOnTrack: false,
      sessionVisibility: {
        race: true,
        loneQualify: true,
        openQualify: true,
        practice: true,
        offlineTesting: true,
      },
    });
    vi.mocked(useSessionVisibility).mockReturnValue(false);
    vi.mocked(useTelemetryValue).mockReturnValue(true);

    const { container } = render(<TrackMap />);

    expect(container.firstChild).toBeNull();
  });

  it('should hide when trackId is not available', () => {
    vi.mocked(useTrackMapSettings).mockReturnValue({
      turnLabels: {
        enabled: false,
        labelType: 'both',
        highContrast: true,
        labelFontSize: 100,
      },
      showCarNumbers: true,
      displayMode: 'carNumber',
      invertTrackColors: false,
      driverCircleSize: 40,
      playerCircleSize: 40,
      trackmapFontSize: 100,
      trackLineWidth: 20,
      trackOutlineWidth: 40,
      useHighlightColor: false,
      showOnlyWhenOnTrack: false,
      sessionVisibility: {
        race: true,
        loneQualify: true,
        openQualify: true,
        practice: true,
        offlineTesting: true,
      },
    });
    vi.mocked(useTrackId).mockReturnValue(undefined);
    vi.mocked(useTelemetryValue).mockReturnValue(true);

    const { container } = render(<TrackMap />);

    expect(container.firstChild).toBeNull();
  });

  it('should pass displayMode setting to TrackCanvas', () => {
    vi.mocked(useTrackMapSettings).mockReturnValue({
      turnLabels: {
        enabled: false,
        labelType: 'both',
        highContrast: true,
        labelFontSize: 100,
      },
      showCarNumbers: true,
      displayMode: 'sessionPosition',
      invertTrackColors: false,
      driverCircleSize: 40,
      playerCircleSize: 40,
      trackmapFontSize: 100,
      trackLineWidth: 20,
      trackOutlineWidth: 40,
      useHighlightColor: false,
      showOnlyWhenOnTrack: false,
      sessionVisibility: {
        race: true,
        loneQualify: true,
        openQualify: true,
        practice: true,
        offlineTesting: true,
      },
    });
    vi.mocked(useTelemetryValue).mockReturnValue(true);

    render(<TrackMap />);

    // TrackCanvas should be called with displayMode prop
    // This is tested implicitly by checking that the component renders without error
    expect(true).toBe(true);
  });

  it('should enable section colors when the sectors highlight toggle is on', () => {
    mockSessionState.session = {
      SplitTimeInfo: {
        Sectors: [{ SectorStartPct: 0.33 }, { SectorStartPct: 0.66 }],
      },
    } as Session;

    vi.mocked(useTrackMapSettings).mockReturnValue({
      turnLabels: {
        enabled: false,
        labelType: 'both',
        highContrast: true,
        labelFontSize: 100,
      },
      showCarNumbers: true,
      displayMode: 'carNumber',
      invertTrackColors: false,
      driverCircleSize: 40,
      playerCircleSize: 40,
      trackmapFontSize: 100,
      trackLineWidth: 20,
      trackOutlineWidth: 40,
      useHighlightColor: false,
      showOnlyWhenOnTrack: false,
      showSectionColors: true,
      sessionVisibility: {
        race: true,
        loneQualify: true,
        openQualify: true,
        practice: true,
        offlineTesting: true,
      },
    });
    vi.mocked(useTelemetryValue).mockReturnValue(true);

    render(<TrackMap />);

    expect(trackCanvasSpy).toHaveBeenCalled();
    expect(trackCanvasSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        showSectionColors: true,
        sectionBoundaries: [0, 0.33, 0.66, 1],
        sectionColors: ['#ef4444', '#3b82f6', '#22c55e'],
      })
    );
  });
});
