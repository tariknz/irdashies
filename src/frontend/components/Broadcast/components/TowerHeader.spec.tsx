import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TowerHeader } from './TowerHeader';

vi.mock('@irdashies/context', () => ({
  useSessionBarSelector: () => undefined,
  useSessionLapsTiming: () => ({ currentLap: 1, totalRaceLaps: 10 }),
  useSessionTimeTiming: () => ({
    sessionType: 'Race',
    time: 0,
    timeRemaining: 100,
    isFixedLapRace: true,
    state: 4,
  }),
}));

describe('TowerHeader logo', () => {
  it('renders a validated inline image', () => {
    const logo = 'data:image/png;base64,YQ==';
    render(<TowerHeader title="Series" theme="imsa" logo={logo} />);
    expect(screen.getByRole('presentation')).toHaveAttribute('src', logo);
  });

  it.each([
    undefined,
    'https://example.com/logo.png',
    'javascript:alert(1)',
    'data:image/svg+xml,<svg onload="alert(1)"/>',
    'data:image/png;base64,YQ==" onerror="alert(1)',
  ])('omits an invalid logo: %s', (logo) => {
    render(<TowerHeader title="Series" theme="imsa" logo={logo} />);
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
    expect(screen.getByText('Series')).toBeInTheDocument();
  });
});
