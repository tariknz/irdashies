import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { OverlayContainer } from './OverlayContainer';

vi.mock('../../WidgetIndex', () => ({
  WIDGET_MAP: {},
}));
vi.mock('@irdashies/context', () => ({
  useDashboard: vi.fn(),
  useRunningState: vi.fn(),
}));
vi.mock('../TrackMap/hooks/useSectorTiming', () => ({
  useSectorTiming: vi.fn(),
}));

import { useDashboard, useRunningState } from '@irdashies/context';
import { useSectorTiming } from '../TrackMap/hooks/useSectorTiming';

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

  it('starts sector timing updates even when no track map is rendered', () => {
    render(<OverlayContainer />);

    expect(useSectorTiming).toHaveBeenCalledTimes(1);
  });
});
