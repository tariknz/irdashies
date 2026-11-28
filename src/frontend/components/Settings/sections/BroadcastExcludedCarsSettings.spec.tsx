import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Driver } from '@irdashies/types';
import { BroadcastExcludedCarsSettings } from './BroadcastExcludedCarsSettings';

const state = vi.hoisted(() => ({
  onDashboardUpdated: vi.fn(),
  drivers: undefined as Driver[] | undefined,
  dashboard: {
    widgets: [] as { id: string; enabled: boolean; config?: object }[],
  },
}));

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: state.dashboard,
    onDashboardUpdated: state.onDashboardUpdated,
  }),
  useSessionDrivers: () => state.drivers,
}));

const driver = (
  CarIdx: number,
  CarID: number,
  CarScreenName: string,
  extra: Partial<Driver> = {}
) =>
  ({
    CarIdx,
    CarID,
    CarScreenName,
    CarIsPaceCar: 0,
    IsSpectator: 0,
    ...extra,
  }) as Driver;

const savedTower = () =>
  state.onDashboardUpdated.mock.calls[0][0].widgets.find(
    (w: { id: string }) => w.id === 'broadcast'
  );

describe('BroadcastExcludedCarsSettings', () => {
  beforeEach(() => {
    state.onDashboardUpdated.mockClear();
    state.drivers = [
      driver(0, 10, 'Porsche 911 GT3 R'),
      driver(1, 10, 'Porsche 911 GT3 R'),
      driver(2, 20, 'Mercedes-AMG GT3'),
      driver(3, 99, 'Pace car', { CarIsPaceCar: 1 }),
    ];
    state.dashboard.widgets = [
      { id: 'broadcast', enabled: true, config: { pageTransition: 'wipe' } },
    ];
  });

  it('offers each car model in the session with its entry count', () => {
    render(<BroadcastExcludedCarsSettings />);

    expect(
      screen.getAllByRole('button', { name: /^Add / }).map((b) => b.textContent)
    ).toEqual(['Add Mercedes-AMG GT3 (1)', 'Add Porsche 911 GT3 R (2)']);
    expect(
      screen.getByRole('heading', { name: 'Excluded cars' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Hidden from the Tower/)).toBeInTheDocument();
    expect(screen.getByText(/No cars excluded/)).toBeInTheDocument();
  });

  it('saves a chosen model in the tower config, leaving the rest', () => {
    render(<BroadcastExcludedCarsSettings />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Add Porsche 911 GT3 R (2)' })
    );

    expect(savedTower().config).toEqual({
      pageTransition: 'wipe',
      excludedCars: [{ carId: 10, name: 'Porsche 911 GT3 R' }],
    });
  });

  it('shows a live count, or that the car is not in this session', () => {
    state.dashboard.widgets[0].config = {
      excludedCars: [
        { carId: 10, name: 'Porsche 911 GT3 R' },
        { carId: 55, name: 'BMW M2 Safety' },
      ],
    };
    render(<BroadcastExcludedCarsSettings />);

    expect(screen.getByText('2 cars in this session')).toBeInTheDocument();
    expect(screen.getByText('not in this session')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add Porsche 911 GT3 R (2)' })
    ).not.toBeInTheDocument();
  });

  it('removes an entry', () => {
    state.dashboard.widgets[0].config = {
      excludedCars: [
        { carId: 10, name: 'Porsche 911 GT3 R' },
        { carId: 20, name: 'Mercedes-AMG GT3' },
      ],
    };
    render(<BroadcastExcludedCarsSettings />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Porsche 911 GT3 R' })
    );

    expect(savedTower().config.excludedCars).toEqual([
      { carId: 20, name: 'Mercedes-AMG GT3' },
    ]);
  });

  it('offers no cars with no session but still shows the saved list', () => {
    state.drivers = undefined;
    state.dashboard.widgets[0].config = {
      excludedCars: [{ carId: 10, name: 'Porsche 911 GT3 R' }],
    };
    render(<BroadcastExcludedCarsSettings />);

    expect(
      screen.queryByRole('button', { name: /^Add / })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Porsche 911 GT3 R')).toBeInTheDocument();
    expect(screen.getByText('not in this session')).toBeInTheDocument();
  });
});
