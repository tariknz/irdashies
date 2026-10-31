import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ActiveSimulator } from '@irdashies/types';
import { Weather } from './Weather';

const mocks = vi.hoisted(() => ({
  simulator: null as ActiveSimulator | null,
}));

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({ isDemoMode: false, currentDashboard: undefined }),
  sessionBarSelectors: { displayUnits: () => 1 },
  trackStateSelectors: { isOnTrack: () => true },
  useSessionBarSelector: () => undefined,
  useTrackStateSelector: () => true,
  useSessionVisibility: () => true,
  useThrottledWeather: () => ({
    trackMoisture: 1,
    windYaw: 0,
    windDirection: 0,
    windVelocity: 0,
    humidity: undefined,
    precipitation: 0,
  }),
  useActiveSimulator: () => mocks.simulator,
}));

vi.mock('@irdashies/domain/weather/useTrackRubberedState', () => ({
  useTrackRubberedState: () => undefined,
}));

describe('Weather', () => {
  beforeEach(() => {
    mocks.simulator = null;
  });

  it('shows the wind cell under iRacing', () => {
    mocks.simulator = 'iracing';
    render(<Weather />);
    expect(screen.getByText('Wind')).toBeInTheDocument();
  });

  it('leaves the wind cell out under LMU, which simulates no wind', () => {
    mocks.simulator = 'lmu';
    render(<Weather />);
    expect(screen.queryByText('Wind')).not.toBeInTheDocument();
    // The rest of the widget is still there.
    expect(screen.getByText('Humidity')).toBeInTheDocument();
  });
});
