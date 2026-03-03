import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DriverStatusBadges } from './DriverStatusBadges';

describe('DriverStatusBadges', () => {
  it('renders nothing when no status flags are set', () => {
    const { container } = render(<DriverStatusBadges />);

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

    expect(container.textContent).toContain('12');
  });

  it('renders pit time when showPitTime is enabled, pit longer than a minute', () => {
    const { container } = render(
      <DriverStatusBadges
        lastPit
        lastPitLap={4}
        pitStopDuration={75}
        showPitTime
      />
    );

    expect(container.textContent).toContain('1:15');
  });

  it('renders repair, penalty, and slowdown badges', () => {
    const { container } = render(
      <DriverStatusBadges repair penalty slowdown />
    );

    expect(container.querySelectorAll('span.border-gray-500')).toHaveLength(3);
  });

  describe('lapsSinceLastPit with pitExitAfterSF', () => {
    it('shows L2 on 2nd lap out when pitExitAfterSF is true (not L3)', () => {
      // pitted lap 5, now lap 7 — without fix this would show L3
      const { container } = render(
        <DriverStatusBadges
          lastPit
          lastPitLap={5}
          lap={7}
          pitLapDisplayMode="lapsSinceLastPit"
          pitExitAfterSF={true}
        />
      );

      expect(container.textContent).toContain('L 2');
      expect(container.textContent).not.toContain('L 3');
    });

    it('shows L3 on 3rd lap out when pitExitAfterSF is true', () => {
      const { container } = render(
        <DriverStatusBadges
          lastPit
          lastPitLap={5}
          lap={8}
          pitLapDisplayMode="lapsSinceLastPit"
          pitExitAfterSF={true}
        />
      );

      expect(container.textContent).toContain('L 3');
    });

    it('uses normal lapsSinceLastPit formula when pitExitAfterSF is false', () => {
      // pitted lap 5, now lap 7 — normal track shows L3
      const { container } = render(
        <DriverStatusBadges
          lastPit
          lastPitLap={5}
          lap={7}
          pitLapDisplayMode="lapsSinceLastPit"
          pitExitAfterSF={false}
        />
      );

      expect(container.textContent).toContain('L 3');
    });
  });
});
