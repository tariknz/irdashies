import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { OverlayContainer } from './OverlayContainer';

vi.mock('../../WidgetIndex', () => ({
  WIDGET_MAP: {},
  getWidget: vi.fn(() => undefined),
}));
vi.mock('@irdashies/context', () => ({
  useDashboard: vi.fn(),
  useRunningState: vi.fn(),
  usePushToPassStoreUpdater: vi.fn(),
  useResetOnDisconnect: vi.fn(),
  usePitLapStoreUpdater: vi.fn(),
  TopSpeedStoreUpdater: vi.fn(),
  SessionTimingStoreUpdater: vi.fn(),
  TrackTemperatureStoreUpdater: vi.fn(),
  SessionBestLapStoreUpdater: vi.fn(),
  useSectorTimingSnapshot: vi.fn(),
  useSectorTimingStore: vi.fn(() => vi.fn()),
}));
vi.mock('@irdashies/domain', () => ({
  useStandingsSettings: vi.fn(),
  useRelativeSettings: vi.fn(),
  useInformationBarSettings: vi.fn(),
}));

import {
  useDashboard,
  useRunningState,
  useSectorTimingSnapshot,
} from '@irdashies/context';

describe('OverlayContainer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useRunningState).mockReturnValue({ running: true });
    vi.mocked(useDashboard).mockReturnValue({
      currentDashboard: {
        widgets: [],
      },
      editMode: false,
      onDashboardUpdated: vi.fn(),
      bridge: {
        toggleLockOverlays: vi.fn(),
      },
      containerBoundsInfo: null,
    } as unknown as ReturnType<typeof useDashboard>);
  });

  it('does not subscribe to sector timing without a sector consumer', () => {
    render(<OverlayContainer />);

    expect(useSectorTimingSnapshot).toHaveBeenCalledWith(false);
  });

  it('subscribes when Sector Delta is enabled', () => {
    vi.mocked(useDashboard).mockReturnValue({
      currentDashboard: {
        widgets: [
          {
            id: 'sectordelta',
            enabled: true,
            layout: { x: 0, y: 0, width: 100, height: 100 },
          },
        ],
      },
      editMode: false,
      onDashboardUpdated: vi.fn(),
      bridge: { toggleLockOverlays: vi.fn() },
      containerBoundsInfo: null,
    } as unknown as ReturnType<typeof useDashboard>);

    render(<OverlayContainer />);

    expect(useSectorTimingSnapshot).toHaveBeenCalledWith(true);
  });
});
