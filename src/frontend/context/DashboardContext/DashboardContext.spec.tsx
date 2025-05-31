import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DashboardProvider, useDashboard } from './DashboardContext';
import type { DashboardBridge, DashboardLayout } from '@irdashies/types';

const mockBridge: DashboardBridge = {
  reloadDashboard: vi.fn(),
  dashboardUpdated: vi.fn(),
  saveDashboard: vi.fn(),
  onEditModeToggled: vi.fn(),
  toggleLockOverlays: vi.fn().mockResolvedValue(true),
  getAppVersion: vi.fn().mockResolvedValue('0.0.7+mock'),
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
  it('provides the current dashboard', () => {
    render(
      <DashboardProvider bridge={mockBridge}>
        <TestComponent />
      </DashboardProvider>
    );

    expect(screen.getByTestId('current-dashboard').textContent).toBe(
      'No Dashboard'
    );
  });

  it('updates the dashboard', () => {
    render(
      <DashboardProvider bridge={mockBridge}>
        <TestComponent />
      </DashboardProvider>
    );

    screen.getByText('Update Dashboard').click();

    expect(mockBridge.saveDashboard).toHaveBeenCalledWith({
      widgets: [
        {
          id: 'test',
          enabled: true,
          layout: { x: 0, y: 0, width: 1, height: 1 },
        },
      ],
    });
  });

  it('reloads the dashboard on mount', () => {
    render(
      <DashboardProvider bridge={mockBridge}>
        <TestComponent />
      </DashboardProvider>
    );

    expect(mockBridge.reloadDashboard).toHaveBeenCalled();
  });

  it('sets the dashboard when updated', () => {
    const mockDashboard: DashboardLayout = {
      widgets: [
        {
          id: 'test',
          enabled: true,
          layout: { x: 0, y: 0, width: 1, height: 1 },
        },
      ],
    };
    mockBridge.dashboardUpdated = (callback) => callback(mockDashboard);

    render(
      <DashboardProvider bridge={mockBridge}>
        <TestComponent />
      </DashboardProvider>
    );

    expect(screen.getByTestId('current-dashboard').textContent).toBe(
      JSON.stringify(mockDashboard)
    );
  });
});
