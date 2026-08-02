import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboard, TrackTemperatureStoreUpdater } from '@irdashies/context';
import { TrackTemperatureUpdater } from './TrackTemperatureUpdater';

vi.mock('@irdashies/context', () => ({
  useDashboard: vi.fn(),
  TrackTemperatureStoreUpdater: vi.fn(() => null),
}));

describe('TrackTemperatureUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not mount TrackTemperatureStoreUpdater when the dashboard has no standings/relative/infobar widget', () => {
    vi.mocked(useDashboard).mockReturnValue({
      currentDashboard: {
        widgets: [{ id: 'map', enabled: true }],
      },
    } as unknown as ReturnType<typeof useDashboard>);

    render(<TrackTemperatureUpdater />);

    expect(TrackTemperatureStoreUpdater).not.toHaveBeenCalled();
  });

  it('does not mount TrackTemperatureStoreUpdater when the standings widget is present but not enabled', () => {
    vi.mocked(useDashboard).mockReturnValue({
      currentDashboard: {
        widgets: [{ id: 'standings', enabled: false }],
      },
    } as unknown as ReturnType<typeof useDashboard>);

    render(<TrackTemperatureUpdater />);

    expect(TrackTemperatureStoreUpdater).not.toHaveBeenCalled();
  });

  it('mounts TrackTemperatureStoreUpdater when an enabled infobar widget is present', () => {
    vi.mocked(useDashboard).mockReturnValue({
      currentDashboard: {
        widgets: [{ id: 'infobar', enabled: true }],
      },
    } as unknown as ReturnType<typeof useDashboard>);

    render(<TrackTemperatureUpdater />);

    expect(TrackTemperatureStoreUpdater).toHaveBeenCalled();
  });
});
