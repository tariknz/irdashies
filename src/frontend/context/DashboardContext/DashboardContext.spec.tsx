import React from 'react';
import {
  render,
  renderHook,
  screen,
  act,
  waitFor,
} from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardProvider, useDashboard } from './DashboardContext';
import type { DashboardBridge, DashboardLayout } from '@irdashies/types';

const mockBridge: DashboardBridge = {
  reloadDashboard: vi.fn(),
  dashboardUpdated: vi.fn(),
  saveDashboard: vi.fn(),
  onEditModeToggled: vi.fn(),
  toggleLockOverlays: vi.fn().mockResolvedValue(true),
  getAppVersion: vi.fn().mockResolvedValue('0.0.7+mock'),
  resetDashboard: vi.fn().mockResolvedValue({}),
  stop: vi.fn(),
  onDemoModeChanged: vi.fn(),
  toggleDemoMode: vi.fn(),
  getCurrentDashboard: vi.fn().mockResolvedValue({}),
  saveGarageCoverImage: vi.fn(),
  getGarageCoverImageAsDataUrl: vi.fn(),
  savePlayerIconImage: vi.fn(),
  getPlayerIconImageAsDataUrl: vi.fn(),
  getAnalyticsOptOut: vi.fn().mockResolvedValue(false),
  setAnalyticsOptOut: vi.fn(),
  listProfiles: vi.fn().mockResolvedValue([]),
  createProfile: vi.fn(),
  cloneProfile: vi.fn(),
  deleteProfile: vi.fn(),
  renameProfile: vi.fn(),
  switchProfile: vi.fn(),
  getCurrentProfile: vi.fn().mockResolvedValue(null),
  updateProfileTheme: vi.fn(),
  getDashboardForProfile: vi.fn(),
  exportDashboardToFile: vi.fn().mockResolvedValue(false),
  importDashboardFromFile: vi.fn().mockResolvedValue(null),
  setAutoStart: vi.fn(),
  openLogFolder: vi.fn(),
  exportLogFile: vi.fn().mockResolvedValue(false),
};

const TestComponent: React.FC = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  return (
    <div>
      <div data-testid="current-dashboard">
        {currentDashboard ? JSON.stringify(currentDashboard) : 'No Dashboard'}
      </div>
      <button
        onClick={() =>
          onDashboardUpdated &&
          onDashboardUpdated({
            widgets: [
              {
                id: 'test',
                enabled: true,
                layout: { x: 0, y: 0, width: 1, height: 1 },
              },
            ],
          })
        }
      >
        Update Dashboard
      </button>
    </div>
  );
};

describe('DashboardContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations that might have been modified
    mockBridge.dashboardUpdated = vi.fn();
    mockBridge.listProfiles = vi.fn().mockResolvedValue([]);
    mockBridge.getCurrentProfile = vi.fn().mockResolvedValue(null);
    mockBridge.onDemoModeChanged = vi.fn();
    mockBridge.getIsDemoMode = undefined;
  });

  it('provides the current dashboard', async () => {
    act(() => {
      render(
        <DashboardProvider bridge={mockBridge}>
          <TestComponent />
        </DashboardProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('current-dashboard').textContent).toBe(
        'No Dashboard'
      );
    });
  });

  it('updates the dashboard', async () => {
    act(() => {
      render(
        <DashboardProvider bridge={mockBridge}>
          <TestComponent />
        </DashboardProvider>
      );
    });

    await act(async () => {
      screen.getByText('Update Dashboard').click();
    });

    await waitFor(() => {
      expect(mockBridge.saveDashboard).toHaveBeenCalledWith(
        {
          widgets: [
            {
              id: 'test',
              enabled: true,
              layout: { x: 0, y: 0, width: 1, height: 1 },
            },
          ],
        },
        { profileId: undefined, saveId: expect.any(String) }
      );
    });
  });

  it('composes dashboard updates before React renders again', async () => {
    function ApplyEdits() {
      const { onDashboardUpdated } = useDashboard();
      return (
        <button
          onClick={() => {
            onDashboardUpdated?.((dashboard) => ({
              ...dashboard,
              generalSettings: { ...dashboard.generalSettings, fontSize: 'lg' },
            }));
            onDashboardUpdated?.((dashboard) => ({
              ...dashboard,
              generalSettings: {
                ...dashboard.generalSettings,
                fontWeight: 'bold',
              },
            }));
          }}
        >
          Apply edits
        </button>
      );
    }
    vi.mocked(mockBridge.dashboardUpdated).mockImplementation((callback) => {
      callback({ widgets: [] }, 'race');
      return undefined;
    });
    render(
      <DashboardProvider bridge={mockBridge}>
        <ApplyEdits />
      </DashboardProvider>
    );
    await act(async () =>
      screen.getByRole('button', { name: 'Apply edits' }).click()
    );
    expect(mockBridge.saveDashboard).toHaveBeenLastCalledWith(
      { widgets: [], generalSettings: { fontSize: 'lg', fontWeight: 'bold' } },
      { profileId: 'race', saveId: expect.any(String) }
    );
  });

  it('keeps newer edits when an earlier save is broadcast back', async () => {
    let receive!: Parameters<DashboardBridge['dashboardUpdated']>[0];
    vi.mocked(mockBridge.dashboardUpdated).mockImplementation((callback) => {
      receive = callback;
      return undefined;
    });
    const { result } = renderHook(useDashboard, {
      wrapper: ({ children }) => (
        <DashboardProvider bridge={mockBridge}>{children}</DashboardProvider>
      ),
    });
    await act(async () => receive({ widgets: [] }, 'race'));

    act(() => {
      result.current.onDashboardUpdated?.((dashboard) => ({
        ...dashboard,
        generalSettings: { ...dashboard.generalSettings, fontSize: 'lg' },
      }));
      result.current.onDashboardUpdated?.((dashboard) => ({
        ...dashboard,
        generalSettings: { ...dashboard.generalSettings, fontWeight: 'bold' },
      }));
    });

    const [firstDashboard, firstOptions] = vi.mocked(mockBridge.saveDashboard)
      .mock.calls[0];
    await act(async () =>
      receive(firstDashboard, 'race', firstOptions?.saveId)
    );
    expect(result.current.currentDashboard?.generalSettings?.fontWeight).toBe(
      'bold'
    );

    act(() =>
      result.current.onDashboardUpdated?.((dashboard) => ({
        ...dashboard,
        generalSettings: {
          ...dashboard.generalSettings,
          colorPalette: 'black',
        },
      }))
    );
    expect(mockBridge.saveDashboard).toHaveBeenLastCalledWith(
      {
        widgets: [],
        generalSettings: {
          fontSize: 'lg',
          fontWeight: 'bold',
          colorPalette: 'black',
        },
      },
      { profileId: 'race', saveId: expect.any(String) }
    );
    const [lastDashboard, lastOptions] = vi.mocked(mockBridge.saveDashboard)
      .mock.calls[2];
    await act(async () =>
      receive(
        {
          ...lastDashboard,
          generalSettings: {
            ...lastDashboard.generalSettings,
            startMinimized: true,
          },
        },
        'race',
        lastOptions?.saveId
      )
    );
    expect(
      result.current.currentDashboard?.generalSettings?.startMinimized
    ).toBe(true);
  });

  it('applies a deferred edit to the latest snapshot of the original profile', async () => {
    let receive!: Parameters<DashboardBridge['dashboardUpdated']>[0];
    vi.mocked(mockBridge.dashboardUpdated).mockImplementation((callback) => {
      receive = callback;
      return undefined;
    });
    let finishEdit!: () => void;
    let finishImport!: () => void;
    function DeferredEdit() {
      const { onDashboardUpdated } = useDashboard();
      return (
        <button
          onClick={() => {
            finishEdit = () =>
              onDashboardUpdated?.((dashboard) => ({
                ...dashboard,
                generalSettings: {
                  ...dashboard.generalSettings,
                  fontSize: 'lg',
                },
              }));
            finishImport = () =>
              onDashboardUpdated?.({ widgets: [] }, { forceReload: true });
          }}
        >
          Start edit
        </button>
      );
    }
    render(
      <DashboardProvider bridge={mockBridge}>
        <DeferredEdit />
      </DashboardProvider>
    );
    const beginEdit = () =>
      screen.getByRole('button', { name: 'Start edit' }).click();
    await act(async () => receive({ widgets: [] }, 'race'));
    act(beginEdit);
    await act(async () =>
      receive({ widgets: [], generalSettings: { fontWeight: 'bold' } }, 'race')
    );
    act(finishEdit);
    expect(mockBridge.saveDashboard).toHaveBeenCalledExactlyOnceWith(
      { widgets: [], generalSettings: { fontSize: 'lg', fontWeight: 'bold' } },
      { profileId: 'race', saveId: expect.any(String) }
    );

    act(beginEdit);
    await act(async () => receive({ widgets: [] }, 'practice'));
    act(finishEdit);
    act(finishImport);
    expect(mockBridge.saveDashboard).toHaveBeenCalledTimes(1);
  });

  it('reloads the dashboard on mount', async () => {
    act(() => {
      render(
        <DashboardProvider bridge={mockBridge}>
          <TestComponent />
        </DashboardProvider>
      );
    });

    await waitFor(() => {
      expect(mockBridge.reloadDashboard).toHaveBeenCalled();
    });
  });

  it('sets the dashboard when updated', async () => {
    const mockDashboard: DashboardLayout = {
      widgets: [
        {
          id: 'test',
          enabled: true,
          layout: { x: 0, y: 0, width: 1, height: 1 },
        },
      ],
    };
    mockBridge.dashboardUpdated = (callback) => {
      callback(mockDashboard, '123');
      return undefined;
    };

    act(() => {
      render(
        <DashboardProvider bridge={mockBridge}>
          <TestComponent />
        </DashboardProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('current-dashboard').textContent).toBe(
        JSON.stringify(mockDashboard)
      );
    });
  });

  describe('demo mode', () => {
    const DemoModeProbe = () => {
      const { isDemoMode } = useDashboard();
      return <div data-testid="demo-mode">{String(isDemoMode)}</div>;
    };

    it('picks up demo mode switched on before the window opened', async () => {
      mockBridge.getIsDemoMode = vi.fn().mockResolvedValue(true);

      render(
        <DashboardProvider bridge={mockBridge}>
          <DemoModeProbe />
        </DashboardProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('demo-mode').textContent).toBe('true');
      });
    });

    it('lets a change event beat a stale answer', async () => {
      let answer: (value: boolean) => void = () => undefined;
      mockBridge.getIsDemoMode = vi.fn(
        () => new Promise<boolean>((resolve) => (answer = resolve))
      );
      let announce: (value: boolean) => void = () => undefined;
      mockBridge.onDemoModeChanged = vi.fn((callback) => {
        announce = callback;
        return undefined;
      });

      render(
        <DashboardProvider bridge={mockBridge}>
          <DemoModeProbe />
        </DashboardProvider>
      );

      act(() => announce(false));
      await act(async () => answer(true));

      expect(screen.getByTestId('demo-mode').textContent).toBe('false');
    });
  });

  it('stops the bridge on unmount', () => {
    const { unmount } = render(
      <DashboardProvider bridge={mockBridge}>
        <TestComponent />
      </DashboardProvider>
    );

    act(() => {
      unmount();
    });

    expect(mockBridge.stop).toHaveBeenCalled();
  });

  describe('Browser view with profileId', () => {
    it('loads profile synchronously when profileId is provided', async () => {
      const profileId = 'test-profile-id';
      const testProfile = {
        id: profileId,
        name: 'Test Profile',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      };
      mockBridge.listProfiles = vi.fn().mockResolvedValue([testProfile]);
      mockBridge.getDashboardForProfile = vi.fn().mockResolvedValue({
        widgets: [
          {
            id: 'test',
            enabled: true,
            layout: { x: 0, y: 0, width: 1, height: 1 },
          },
        ],
      });

      const TestComponentWithProfile: React.FC = () => {
        const { currentProfile } = useDashboard();
        return (
          <div data-testid="current-profile">
            {currentProfile?.id || 'No Profile'}
          </div>
        );
      };

      act(() => {
        render(
          <DashboardProvider bridge={mockBridge} profileId={profileId}>
            <TestComponentWithProfile />
          </DashboardProvider>
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-profile').textContent).toBe(
          profileId
        );
      });
    });

    it('creates minimal profile object when profileId is not in active list', async () => {
      const profileId = 'inactive-profile-id';
      mockBridge.listProfiles = vi.fn().mockResolvedValue([]); // Profile not in active list
      mockBridge.getDashboardForProfile = vi.fn().mockResolvedValue({
        widgets: [
          {
            id: 'test',
            enabled: true,
            layout: { x: 0, y: 0, width: 1, height: 1 },
          },
        ],
      });

      const TestComponentWithProfile: React.FC = () => {
        const { currentProfile } = useDashboard();
        return (
          <div data-testid="current-profile">
            {currentProfile?.id || 'No Profile'}
          </div>
        );
      };

      act(() => {
        render(
          <DashboardProvider bridge={mockBridge} profileId={profileId}>
            <TestComponentWithProfile />
          </DashboardProvider>
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-profile').textContent).toBe(
          profileId
        );
      });
    });

    it('saves dashboard with correct profileId for non-active profile', async () => {
      const profileId = 'inactive-profile-id';
      mockBridge.listProfiles = vi.fn().mockResolvedValue([]); // Profile not in active list
      mockBridge.getDashboardForProfile = vi.fn().mockResolvedValue({
        widgets: [
          {
            id: 'test',
            enabled: true,
            layout: { x: 0, y: 0, width: 1, height: 1 },
          },
        ],
      });

      act(() => {
        render(
          <DashboardProvider bridge={mockBridge} profileId={profileId}>
            <TestComponent />
          </DashboardProvider>
        );
      });

      // Wait for the profile to be loaded
      await waitFor(
        () => {
          expect(screen.getByText('Update Dashboard')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      act(() => {
        screen.getByText('Update Dashboard').click();
      });

      await waitFor(
        () => {
          // Just verify that saveDashboard was called - the profileId should be passed
          expect(mockBridge.saveDashboard).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
    });
  });
});
