import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Standings } from '@irdashies/domain';
import { BroadcastTicker } from './BroadcastTicker';

const standings = vi.hoisted(() => ({ cars: [] as unknown[] }));

vi.mock('@irdashies/context', () => ({
  useSessionVisibility: () => true,
  useWeekendInfoTeamRacing: () => 0,
}));
vi.mock('@irdashies/domain/standings/useDriverStandings', () => ({
  useDriverStandings: () => [['1', standings.cars]],
}));
vi.mock('./hooks/useBroadcastTickerSettings', () => ({
  useBroadcastTickerSettings: () => ({ secondsPerEntry: 2 }),
}));
vi.mock('../shared/CarManufacturer/CarManufacturer', () => ({
  CarManufacturer: () => null,
}));

const car = (carIdx: number) =>
  ({
    carIdx,
    position: carIdx + 1,
    carClass: { id: 1, color: 0xffffff },
    driver: { name: `Driver ${carIdx}`, carNum: `${carIdx}` },
  }) as unknown as Standings;

const marquee = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[style*="broadcast-marquee"]');

describe('BroadcastTicker', () => {
  it('keeps the loop length until the loop ends, even if a car joins', () => {
    standings.cars = [car(0), car(1), car(2)];
    const { container, rerender } = render(<BroadcastTicker />);
    expect(marquee(container)?.style.animation).toContain('6s');

    standings.cars = [car(0), car(1), car(2), car(3)];
    rerender(<BroadcastTicker />);
    expect(marquee(container)?.style.animation).toContain('6s');

    const el = marquee(container);
    // jsdom has no AnimationEvent, so React listens for the prefixed name.
    if (el) fireEvent(el, new Event('webkitAnimationEnd', { bubbles: true }));
    expect(container.textContent).toContain('Fastest Lap');
    expect(marquee(container)?.style.animation).toContain('8s');
  });
});
