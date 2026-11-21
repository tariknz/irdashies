import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DrivingMetricSettings } from './DrivingMetricSettings';

const frame = {
  background: { opacity: 80 },
  showOnlyWhenOnTrack: false,
  sessionVisibility: {
    race: true,
    loneQualify: true,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
};

const dashboard = {
  widgets: [
    {
      id: 'tyrepanel',
      enabled: true,
      config: {
        ...frame,
        pressureUnit: 'kPa',
        temperatureUnit: 'C',
        temperatureThresholds: { cold: 70, hot: 100 },
        wearThresholds: { worn: 60, replace: 30 },
      },
    },
    { id: 'stinthistory', enabled: true, config: { ...frame, maxStints: 3 } },
  ],
};

vi.mock('@irdashies/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@irdashies/context')>()),
  useDashboard: () => ({
    currentDashboard: dashboard,
    onDashboardUpdated: vi.fn(),
    bridge: {},
  }),
}));

const hasText = (text: string) => screen.queryAllByText(text).length > 0;

beforeEach(() => {
  window.localStorage.clear();
});

describe('DrivingMetricSettings', () => {
  it('splits the Tyre Panel into an Options tab and a Visibility tab', async () => {
    render(<DrivingMetricSettings id="tyrepanel" />);

    expect(screen.getByRole('button', { name: 'Options' })).toBeTruthy();
    expect(hasText('Units')).toBe(true);
    expect(hasText('Temperature bands')).toBe(true);
    expect(hasText('Tread bands')).toBe(true);
    expect(hasText('Display')).toBe(true);
    expect(hasText('Background opacity')).toBe(true);
    expect(hasText('Show only when on track')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Visibility' }));

    expect(hasText('Show only when on track')).toBe(true);
    expect(hasText('Units')).toBe(false);
    expect(hasText('Temperature bands')).toBe(false);
    expect(hasText('Background opacity')).toBe(false);
  });

  it('keeps the other driving metric pages on one page without tabs', () => {
    render(<DrivingMetricSettings id="stinthistory" />);

    expect(screen.queryByRole('button', { name: 'Options' })).toBeNull();
    expect(hasText('Stints shown')).toBe(true);
    expect(hasText('Background opacity')).toBe(true);
    expect(hasText('Show only when on track')).toBe(true);
  });
});
