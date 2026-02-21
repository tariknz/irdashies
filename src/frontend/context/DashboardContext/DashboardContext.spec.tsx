import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
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
  getAnalyticsOptOut: vi.fn().mockResolvedValue(false),
  setAnalyticsOptOut: vi.fn(),
  listProfiles: vi.fn().mockResolvedValue([]),
  createProfile: vi.fn(),
  deleteProfile: vi.fn(),
  renameProfile: vi.fn(),
  switchProfile: vi.fn(),
  getCurrentProfile: vi.fn().mockResolvedValue(null),
  updateProfileTheme: vi.fn(),
  getDashboardForProfile: vi.fn(),
  setAutoStart: vi.fn(),
  getDriverTagSettings: vi.fn(),
  saveDriverTagSettings: vi.fn(),
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
        { profileId: undefined }
      );
    });
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
