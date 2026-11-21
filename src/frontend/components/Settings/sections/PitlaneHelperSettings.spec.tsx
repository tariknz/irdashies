import { mockDashboardUpdater } from '../mockDashboardUpdater';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SIM_WIDGET_SUPPORT,
  defaultDashboard,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { PitlaneHelperSettings } from './PitlaneHelperSettings';

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
let dashboard = defaultDashboard;

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: dashboard,
    onDashboardUpdated: mockDashboardUpdater(() => dashboard, mocks.update),
  }),
  useActiveSimulator: () => null,
  useSimWidgetSupport: () => DEFAULT_SIM_WIDGET_SUPPORT,
}));

beforeEach(() => {
  dashboard = defaultDashboard;
  mocks.update.mockClear();
  localStorage.removeItem('pitLaneTab');
  window.pitLaneBridge = {
    getPitLaneData: async (trackId) => ({
      trackId,
      sourceId: 'test-source',
      revision: 0,
      data: null,
    }),
    updatePitLaneData: async () => true,
    getCurrentTrackPitLaneInfo: async () => ({
      trackId: '47',
      trackName: 'Laguna Seca',
      hasCalibration: true,
    }),
    resetPitLaneData: async () => undefined,
    openPitLaneDataFile: async () => undefined,
    reloadPitLaneDataFile: async () => undefined,
  };
});

it('uses the updated session settings when the dashboard changes', () => {
  localStorage.setItem('pitLaneTab', 'visibility');
  const view = render(<PitlaneHelperSettings />);
  expect(screen.getByRole('switch', { name: 'Practice' })).toBeChecked();

  const sessionVisibility = {
    ...getWidgetDefaultConfig('pitlanehelper').sessionVisibility,
    practice: false,
    race: false,
  };
  dashboard = {
    ...dashboard,
    widgets: dashboard.widgets.map((widget) =>
      widget.id === 'pitlanehelper'
        ? {
            ...widget,
            config: {
              ...widget.config,
              sessionVisibility,
            },
          }
        : widget
    ),
  };
  view.rerender(<PitlaneHelperSettings />);

  const practiceToggle = screen.getByRole('switch', { name: 'Practice' });
  expect(practiceToggle).not.toBeChecked();
  fireEvent.click(practiceToggle);

  expect(mocks.update).toHaveBeenCalledWith({
    ...dashboard,
    widgets: dashboard.widgets.map((widget) =>
      widget.id === 'pitlanehelper'
        ? {
            ...widget,
            config: {
              ...widget.config,
              sessionVisibility: { ...sessionVisibility, practice: true },
            },
          }
        : widget
    ),
  });
});

describe('Pitlane Helper calibration tab', () => {
  it('keeps calibration actions in their own tab beside Options and Visibility', async () => {
    render(<PitlaneHelperSettings />);
    const tabs = screen
      .getAllByRole('button')
      .filter((button) =>
        ['Options', 'Visibility', 'Calibration'].includes(
          button.textContent ?? ''
        )
      );
    expect(tabs.map((button) => button.textContent)).toEqual([
      'Options',
      'Visibility',
      'Calibration',
    ]);
    expect(screen.getByText('Show when approaching pit')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reset calibration' })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Calibration' }));
    await screen.findByText('Laguna Seca');
    expect(
      screen.getByRole('button', { name: 'Reset calibration' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open calibration file' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reload file' })
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Show when approaching pit')
    ).not.toBeInTheDocument();
    expect(localStorage.getItem('pitLaneTab')).toBe('calibration');
    fireEvent.click(screen.getByRole('button', { name: 'Visibility' }));
    expect(
      screen.queryByRole('button', { name: 'Reset calibration' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Session Visibility')).toBeInTheDocument();
  });

  it('restores the saved calibration tab on reopening settings', async () => {
    localStorage.setItem('pitLaneTab', 'calibration');
    render(<PitlaneHelperSettings />);
    await screen.findByText('Laguna Seca');
    expect(
      screen.getByRole('button', { name: 'Open calibration file' })
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Show when approaching pit')
    ).not.toBeInTheDocument();
  });

  it('falls back to Options for an invalid saved tab', () => {
    localStorage.setItem('pitLaneTab', 'invalid-tab');
    render(<PitlaneHelperSettings />);
    expect(screen.getByText('Show when approaching pit')).toBeInTheDocument();
    expect(localStorage.getItem('pitLaneTab')).toBe('options');
  });
});
