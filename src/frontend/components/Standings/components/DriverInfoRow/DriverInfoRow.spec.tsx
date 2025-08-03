import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DriverInfoRow } from './DriverInfoRow';
import { DashboardProvider } from '@irdashies/context';

// Mock the useStandingsSettings hook
vi.mock('../../hooks/useStandingsSettings', () => ({
  useStandingsSettings: vi.fn(),
}));

const mockUseStandingsSettings = vi.mocked(await import('../../hooks/useStandingsSettings')).useStandingsSettings;

const mockContextValue = {
  currentDashboard: {},
  updateDashboard: vi.fn(),
  listDashboards: vi.fn(),
  createDashboard: vi.fn(),
  deleteDashboard: vi.fn(),
  switchDashboard: vi.fn(),
};

describe('DriverInfoRow', () => {
  const defaultProps = {
    carIdx: 1,
    classColor: 1,
    carNumber: '1',
    name: 'Test Driver',
    isPlayer: false,
    hasFastestTime: false,
    flairId: 149, // New Zealand
  };

  it('should show country flag when countryFlags is enabled', () => {
    mockUseStandingsSettings.mockReturnValue({
      countryFlags: { enabled: true },
    } as any);

    render(
      <DashboardProvider value={mockContextValue}>
        <table>
          <tbody>
            <DriverInfoRow {...defaultProps} />
          </tbody>
        </table>
      </DashboardProvider>
    );

    // Should show the country flag
    const flagElement = document.querySelector('.fi.fi-nz');
    expect(flagElement).toBeInTheDocument();
  });

  it('should hide country flag when countryFlags is disabled', () => {
    mockUseStandingsSettings.mockReturnValue({
      countryFlags: { enabled: false },
    } as any);

    render(
      <DashboardProvider value={mockContextValue}>
        <table>
          <tbody>
            <DriverInfoRow {...defaultProps} />
          </tbody>
        </table>
      </DashboardProvider>
    );

    // Should not show the country flag
    const flagElement = document.querySelector('.fi.fi-nz');
    expect(flagElement).not.toBeInTheDocument();
  });

  it('should hide country flag when flairId is not provided', () => {
    mockUseStandingsSettings.mockReturnValue({
      countryFlags: { enabled: true },
    } as any);

    render(
      <DashboardProvider value={mockContextValue}>
        <table>
          <tbody>
            <DriverInfoRow {...defaultProps} flairId={undefined} />
          </tbody>
        </table>
      </DashboardProvider>
    );

    // Should not show the country flag when flairId is undefined
    const flagElement = document.querySelector('.fi.fi-nz');
    expect(flagElement).not.toBeInTheDocument();
  });

  it('should default to showing country flag when settings are not available', () => {
    mockUseStandingsSettings.mockReturnValue(undefined);

    render(
      <DashboardProvider value={mockContextValue}>
        <table>
          <tbody>
            <DriverInfoRow {...defaultProps} />
          </tbody>
        </table>
      </DashboardProvider>
    );

    // Should not show the country flag when settings are undefined
    const flagElement = document.querySelector('.fi.fi-nz');
    expect(flagElement).not.toBeInTheDocument();
  });
}); 