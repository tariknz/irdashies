import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StandingsSettings } from './StandingsSettings';
import { DashboardProvider } from '@irdashies/context';

// Mock the dashboard context
const mockDashboard = {
  widgets: [
    {
      id: 'standings',
      enabled: true,
      config: {
        iRatingChange: { enabled: true },
        badge: { enabled: true },
        delta: { enabled: true },
        lastTime: { enabled: true },
        fastestTime: { enabled: true },
        background: { opacity: 0 },
        countryFlags: { enabled: true },
        driverStandings: {
          buffer: 3,
          numNonClassDrivers: 3,
          minPlayerClassDrivers: 10,
          numTopDrivers: 3,
        },
      },
    },
  ],
  generalSettings: {
    fontSize: 'sm',
    colorPalette: 'default',
  },
};

const mockContextValue = {
  currentDashboard: mockDashboard,
  updateDashboard: vi.fn(),
  listDashboards: vi.fn(),
  createDashboard: vi.fn(),
  deleteDashboard: vi.fn(),
  switchDashboard: vi.fn(),
};

describe('StandingsSettings', () => {
  it('should render the show country flags toggle', () => {
    render(
      <DashboardProvider value={mockContextValue}>
        <StandingsSettings />
      </DashboardProvider>
    );

    expect(screen.getByText('Show Country Flags')).toBeInTheDocument();
  });

  it('should default to enabled when setting does not exist', () => {
    const dashboardWithoutSetting = {
      ...mockDashboard,
      widgets: [
        {
          id: 'standings',
          enabled: true,
          config: {
            iRatingChange: { enabled: true },
            badge: { enabled: true },
            delta: { enabled: true },
            lastTime: { enabled: true },
            fastestTime: { enabled: true },
            background: { opacity: 0 },
            // countryFlags setting is missing
            driverStandings: {
              buffer: 3,
              numNonClassDrivers: 3,
              minPlayerClassDrivers: 10,
              numTopDrivers: 3,
            },
          },
        },
      ],
    };

    const contextValueWithoutSetting = {
      ...mockContextValue,
      currentDashboard: dashboardWithoutSetting,
    };

    render(
      <DashboardProvider value={contextValueWithoutSetting}>
        <StandingsSettings />
      </DashboardProvider>
    );

    // The toggle should be enabled by default
    const toggle = screen.getByText('Show Country Flags').closest('div')?.querySelector('button');
    expect(toggle).toHaveAttribute('data-state', 'checked');
  });
}); 