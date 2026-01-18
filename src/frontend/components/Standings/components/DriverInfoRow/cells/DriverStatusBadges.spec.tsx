import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DriverStatusBadges } from './DriverStatusBadges';

describe('DriverStatusBadges', () => {
  it('renders nothing when no status flags are set', () => {
    const { container } = render(<DriverStatusBadges />);

    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when hidden is true', () => {
    const { container } = render(
      <DriverStatusBadges hidden dnf />
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders DNF when dnf is true', () => {
    const { container } = render(<DriverStatusBadges dnf />);

    expect(container.textContent).toContain('DNF');
  });

  it('renders TOW when tow is true', () => {
    const { container } = render(<DriverStatusBadges tow />);

    expect(container.textContent).toContain('TOW');
  });

  it('renders PIT when pit is true', () => {
    const { container } = render(<DriverStatusBadges pit />);

    expect(container.textContent).toContain('PIT');
  });

  it('renders OUT when out is true', () => {
    const { container } = render(<DriverStatusBadges out />);

    expect(container.textContent).toContain('OUT');
  });

  it('renders last pit lap when lastPit is true', () => {
    const { container } = render(<DriverStatusBadges lastPit lastPitLap={2} />);

    expect(container.textContent).toContain('L 2');
  });

  it('renders pit time when showPitTime is enabled', () => {
    const { container } = render(
      <DriverStatusBadges
        lastPit
        lastPitLap={4}
        pitStopDuration={12}
        showPitTime
      />
    );

    expect(container.textContent).toContain('L 4 12 s');
  });

  it('renders repair, penalty, and slowdown badges', () => {
    const { container } = render(
      <DriverStatusBadges repair penalty slowdown />
    );

    expect(container.querySelectorAll('span.border-gray-500')).toHaveLength(3);
  });
});
