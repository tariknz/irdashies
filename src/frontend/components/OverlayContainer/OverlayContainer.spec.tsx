import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  useWidgetsForThisDisplay: vi.fn(() => []),
  rendersInOwnWindow: (widget: { id: string; type?: string }) =>
    (widget.type || widget.id) === 'gantry',
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
  useWidgetsForThisDisplay,
} from '@irdashies/context';
import { getWidget } from '../../WidgetIndex';

const mockDashboard = (widgets: unknown[]) => {
  vi.mocked(useDashboard).mockReturnValue({
    currentDashboard: { widgets },
    editMode: false,
    onDashboardUpdated: vi.fn(),
    bridge: {
      toggleLockOverlays: vi.fn(),
    },
    containerBoundsInfo: null,
  } as unknown as ReturnType<typeof useDashboard>);
  vi.mocked(useWidgetsForThisDisplay).mockReturnValue(
    widgets as ReturnType<typeof useWidgetsForThisDisplay>
  );
};

describe('OverlayContainer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useRunningState).mockReturnValue({ running: true });
    mockDashboard([]);
  });

  it('does not subscribe to sector timing without a sector consumer', () => {
    render(<OverlayContainer />);

    expect(useSectorTimingSnapshot).toHaveBeenCalledWith(false);
  });

  it('does not render Gantry, which has a window of its own', () => {
    vi.mocked(getWidget).mockImplementation(
      () => (() => <div data-testid="widget-body" />) as never
    );
    mockDashboard([
      {
        id: 'gantry',
        enabled: true,
        layout: { x: 0, y: 0, width: 100, height: 100 },
      },
    ]);

    render(<OverlayContainer />);

    expect(screen.queryByTestId('widget-body')).toBeNull();
  });

  it('subscribes when Sector Delta is enabled', () => {
    mockDashboard([
      {
        id: 'sectordelta',
        enabled: true,
        layout: { x: 0, y: 0, width: 100, height: 100 },
      },
    ]);

    render(<OverlayContainer />);

    expect(useSectorTimingSnapshot).toHaveBeenCalledWith(true);
  });
});
