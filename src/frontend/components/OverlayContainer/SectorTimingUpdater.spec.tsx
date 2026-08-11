import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SectorTimingUpdater } from './SectorTimingUpdater';

const applySnapshot = vi.fn();
const setThresholds = vi.fn();
const useDashboard = vi.fn();

vi.mock('@irdashies/context', () => ({
  useDashboard: () => useDashboard(),
  useSectorTimingSnapshot: vi.fn(() => undefined),
  useSectorTimingStore: vi.fn((selector: (state: unknown) => unknown) =>
    selector({ applySnapshot, setThresholds })
  ),
}));

describe('SectorTimingUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies Sector Delta thresholds for a map-only renderer', () => {
    useDashboard.mockReturnValue({
      currentDashboard: {
        widgets: [
          {
            id: 'sector-on-another-display',
            type: 'sectordelta',
            config: { thresholds: { green: 0.7, yellow: 1.4 } },
          },
          { id: 'map', config: {} },
        ],
      },
    });

    render(<SectorTimingUpdater enabled />);

    expect(setThresholds).toHaveBeenCalledOnce();
    expect(setThresholds.mock.calls[0][0]).toBeCloseTo(0.007);
    expect(setThresholds.mock.calls[0][1]).toBeCloseTo(0.014);
  });

  it('applies default thresholds when Sector Delta is absent', () => {
    useDashboard.mockReturnValue({ currentDashboard: { widgets: [] } });

    render(<SectorTimingUpdater enabled />);

    expect(setThresholds).toHaveBeenCalledWith(0.005, 0.01);
  });
});
