import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ActiveSimulator } from '@irdashies/types';
import { Weather } from './Weather';

const mocks = vi.hoisted(() => ({
  simulator: null as ActiveSimulator | null,
  isDemoMode: false,
  windYaw: 0,
  weatherSettings: null as {
    units?: 'auto' | 'Metric' | 'Imperial';
    forecast?: { enabled: boolean };
  } | null,
}));

const sessionBar = {
  displayUnits: 1,
  sessionTimeOfDay: 12 * 60 * 60,
  airTemp: 20,
  trackTemp: 30,
  precipitation: 0,
};

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    isDemoMode: mocks.isDemoMode,
    currentDashboard: undefined,
  }),
  sessionBarSelectors: { displayUnits: () => 1 },
  trackStateSelectors: { isOnTrack: () => true },
  useSessionBarSelector: (selector: (snapshot: typeof sessionBar) => unknown) =>
    selector(sessionBar),
  useSessionStore: {},
  useTrackStateSelector: () => true,
  useSessionVisibility: () => true,
  useThrottledWeather: () => ({
    trackMoisture: 1,
    windYaw: mocks.windYaw,
    windDirection: 0,
    windVelocity: 0,
    humidity: undefined,
    precipitation: 0,
  }),
  useActiveSimulator: () => mocks.simulator,
}));

vi.mock('zustand', () => ({
  useStore: (
    _store: unknown,
    selector: (state: {
      session: { WeekendInfo: { TrackSkies: string } };
    }) => unknown
  ) => selector({ session: { WeekendInfo: { TrackSkies: 'Partly Cloudy' } } }),
}));

vi.mock('./hooks/useWeatherSettings', () => ({
  useWeatherSettings: () => mocks.weatherSettings,
}));

describe('Weather', () => {
  beforeEach(() => {
    mocks.simulator = null;
    mocks.isDemoMode = false;
    mocks.windYaw = 0;
    mocks.weatherSettings = null;
  });

  it('shows the redesigned surface, temperature and wind summary', () => {
    mocks.simulator = 'iracing';
    render(<Weather />);

    expect(screen.getByText('DRY')).toBeInTheDocument();
    expect(screen.getByText('Partly Cloudy')).toBeInTheDocument();
    expect(screen.getByText('20°')).toBeInTheDocument();
    expect(screen.getByText('track 30°')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('converts temperatures when Imperial units are selected', () => {
    mocks.weatherSettings = { units: 'Imperial' };
    render(<Weather />);

    expect(screen.getByText('68°')).toBeInTheDocument();
    expect(screen.getByText('track 86°')).toBeInTheDocument();
  });

  it('hides the forecast when its setting is disabled', () => {
    mocks.weatherSettings = { forecast: { enabled: false } };
    render(<Weather />);

    expect(screen.queryByText('13:00')).not.toBeInTheDocument();
  });

  it('omits the wind arrow for LMU while keeping the weather summary', () => {
    mocks.simulator = 'lmu';
    const { container } = render(<Weather />);

    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByText('DRY')).toBeInTheDocument();
  });

  it('keeps demo wind direction independent of telemetry yaw', () => {
    mocks.isDemoMode = true;
    mocks.windYaw = Math.PI / 2;
    const { container } = render(<Weather />);

    expect(container.querySelector('svg')?.style.rotate).toBe('180deg');
  });

  it('shows the rain warning in demo mode', () => {
    mocks.isDemoMode = true;
    render(<Weather />);

    expect(screen.getByText(/RAIN IN ~\s*2H/)).toBeInTheDocument();
  });
});
