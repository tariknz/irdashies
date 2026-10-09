import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboard } from '../DashboardContext/DashboardContext';
import { SessionTimingStoreUpdater } from './SessionTimingStoreUpdater';
import { SessionTimingUpdater } from './SessionTimingUpdater';

vi.mock('../DashboardContext/DashboardContext', () => ({
  useDashboard: vi.fn(),
}));

vi.mock('./SessionTimingStoreUpdater', () => ({
  SessionTimingStoreUpdater: vi.fn(() => null),
}));

const lastEnabledArg = () => {
  const calls = vi.mocked(SessionTimingStoreUpdater).mock.calls;
  return calls[calls.length - 1][0].enabled;
};

describe('SessionTimingUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not mount SessionTimingStoreUpdater when the dashboard has no standings/relative/infobar widget', () => {
    vi.mocked(useDashboard).mockReturnValue({
      currentDashboard: {
        widgets: [{ id: 'map', enabled: true }],
      },
    } as unknown as ReturnType<typeof useDashboard>);

    render(<SessionTimingUpdater />);

    expect(SessionTimingStoreUpdater).not.toHaveBeenCalled();
  });

  it('does not mount SessionTimingStoreUpdater when the standings widget is present but not enabled', () => {
    vi.mocked(useDashboard).mockReturnValue({
      currentDashboard: {
        widgets: [{ id: 'standings', enabled: false }],
      },
    } as unknown as ReturnType<typeof useDashboard>);

    render(<SessionTimingUpdater />);

    expect(SessionTimingStoreUpdater).not.toHaveBeenCalled();
  });

  it('is enabled when an enabled standings widget is present', () => {
    vi.mocked(useDashboard).mockReturnValue({
      currentDashboard: {
        widgets: [{ id: 'standings', enabled: true }],
      },
    } as unknown as ReturnType<typeof useDashboard>);

    render(<SessionTimingUpdater />);

    expect(lastEnabledArg()).toBe(true);
  });

  it('is enabled when an enabled infobar widget is present', () => {
    vi.mocked(useDashboard).mockReturnValue({
      currentDashboard: {
        widgets: [{ id: 'infobar', enabled: true }],
      },
    } as unknown as ReturnType<typeof useDashboard>);

    render(<SessionTimingUpdater />);

    expect(lastEnabledArg()).toBe(true);
  });

  it('is enabled for a second instance of a widget, which names its type', () => {
    vi.mocked(useDashboard).mockReturnValue({
      currentDashboard: {
        widgets: [{ id: 'standings-2', type: 'standings', enabled: true }],
      },
    } as unknown as ReturnType<typeof useDashboard>);

    render(<SessionTimingUpdater />);

    expect(lastEnabledArg()).toBe(true);
  });

  describe('on a single-widget page', () => {
    // The VR setup: every desktop overlay switched off, the widget opened by
    // its own URL.
    it('is enabled for a timing widget that is disabled on the desktop', () => {
      vi.mocked(useDashboard).mockReturnValue({
        currentDashboard: {
          widgets: [{ id: 'standings', enabled: false }],
        },
      } as unknown as ReturnType<typeof useDashboard>);

      render(<SessionTimingUpdater soloWidgetType="standings" />);

      expect(lastEnabledArg()).toBe(true);
    });

    it('does not mount for a widget with no session bar, whatever else is enabled', () => {
      vi.mocked(useDashboard).mockReturnValue({
        currentDashboard: {
          widgets: [{ id: 'standings', enabled: true }],
        },
      } as unknown as ReturnType<typeof useDashboard>);

      render(<SessionTimingUpdater soloWidgetType="map" />);

      expect(SessionTimingStoreUpdater).not.toHaveBeenCalled();
    });
  });
});
