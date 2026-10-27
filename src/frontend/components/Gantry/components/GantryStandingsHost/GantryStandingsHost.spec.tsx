import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardWidget } from '@irdashies/types';

const mocks = vi.hoisted(() => ({
  running: true,
  holding: false,
  focusDriver: vi.fn(() => Promise.resolve()),
  configs: [] as unknown[],
}));

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({ currentDashboard: undefined }),
  useRunningState: () => ({ running: mocks.running }),
  useSessionDrivers: () => [
    { CarIdx: 4, CarNumber: '77' },
    { CarIdx: 5, CarNumber: '12' },
  ],
  usePitLapStoreUpdater: () => undefined,
  usePushToPassStoreUpdater: () => undefined,
  SessionTimingUpdater: () => null,
}));

vi.mock('../../hooks/useGantrySessionHold', () => ({
  useGantrySessionHold: () => ({ holding: mocks.holding, epoch: 0 }),
}));

vi.mock('../../../RendererDataProviders/RendererDataProviders', () => ({
  RendererDataProviders: () => null,
}));

vi.mock('../../../../WidgetIndex', async () => {
  const { useStandingsInteraction, useStandingsSettings } =
    await import('@irdashies/domain');
  const FakeStandings = () => {
    const { onSelectCar, highlightedCarIdx } = useStandingsInteraction();
    mocks.configs.push(useStandingsSettings());
    return (
      <div>
        <button onClick={() => onSelectCar?.(5)}>pick</button>
        <span data-testid="highlighted">{String(highlightedCarIdx)}</span>
      </div>
    );
  };
  return { getWidget: () => FakeStandings };
});

vi.mock('@irdashies/utils/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { GantryStandingsHost } from './GantryStandingsHost';

const widget: DashboardWidget = {
  id: 'standings-g1',
  type: 'standings',
  enabled: true,
  placement: 'gantry',
  layout: { x: 0, y: 0, width: 1, height: 1 },
  config: {
    showOnlyWhenOnTrack: true,
    driverStandings: { showAll: false, numTopDrivers: 3 },
  },
};

const lastConfig = () =>
  mocks.configs[mocks.configs.length - 1] as Record<string, unknown>;

describe('GantryStandingsHost', () => {
  beforeEach(() => {
    mocks.running = true;
    mocks.holding = false;
    mocks.configs = [];
    mocks.focusDriver.mockClear();
    window.raceControlBridge = {
      focusDriver: mocks.focusDriver,
    } as unknown as typeof window.raceControlBridge;
  });

  it('points the sim camera at the clicked car by its car number', () => {
    render(
      <GantryStandingsHost
        widget={widget}
        source="gantry"
        followedCarIdx={null}
      />
    );

    fireEvent.click(screen.getByText('pick'));

    expect(mocks.focusDriver).toHaveBeenCalledWith('12');
  });

  it('passes the followed car down for highlighting', () => {
    render(
      <GantryStandingsHost widget={widget} source="gantry" followedCarIdx={4} />
    );

    expect(screen.getByTestId('highlighted').textContent).toBe('4');
  });

  it('turns off the overlay hide rules and keeps the layout show-all choice', () => {
    render(
      <GantryStandingsHost
        widget={widget}
        source="gantry"
        followedCarIdx={null}
      />
    );

    expect(lastConfig()).toMatchObject({
      showOnlyWhenOnTrack: false,
      driverStandings: { showAll: false, numTopDrivers: 3 },
    });
  });

  it('lists every driver for the overlay source', () => {
    render(
      <GantryStandingsHost
        widget={widget}
        source="overlay"
        followedCarIdx={null}
      />
    );

    expect(lastConfig()).toMatchObject({
      driverStandings: { showAll: true },
    });
  });

  it('keeps rendering while the finished session is held', () => {
    mocks.running = false;
    mocks.holding = true;
    render(
      <GantryStandingsHost
        widget={widget}
        source="gantry"
        followedCarIdx={null}
      />
    );

    expect(screen.getByText('pick')).toBeTruthy();
  });

  it('waits for the sim when nothing has been held', () => {
    mocks.running = false;
    render(
      <GantryStandingsHost
        widget={widget}
        source="gantry"
        followedCarIdx={null}
      />
    );

    expect(screen.getByText('Waiting for iRacing.')).toBeTruthy();
  });
});
