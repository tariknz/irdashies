import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FuelLapData } from '@irdashies/types';
import { defaultFuelCalculatorSettings } from '../defaults';
import { useFuelStore } from '../FuelStore';
import { FuelHistory } from './FuelHistory';

const dashboard = vi.hoisted(() => ({ isDemoMode: false }));
vi.mock('@irdashies/context', () => ({ useDashboard: () => dashboard }));

const lap = (
  lapNumber: number,
  fuelUsed: number,
  extra: Partial<FuelLapData> = {}
): FuelLapData => ({
  lapNumber,
  fuelUsed,
  lapTime: 90,
  isGreenFlag: true,
  isValidForCalc: true,
  isOutLap: false,
  timestamp: lapNumber * 90000,
  ...extra,
});
const settings = {
  ...defaultFuelCalculatorSettings,
  fuelHistoryType: 'table' as const,
};
const rows = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    );

beforeEach(() => {
  dashboard.isDemoMode = false;
  useFuelStore.getState().clearAllData();
  useFuelStore.getState().updateSessionInfo(-1);
});
afterEach(() => act(() => useFuelStore.getState().clearAllData()));

describe('FuelHistory table', () => {
  it('shows the newest three or five completed laps with exact unit formatting', () => {
    useFuelStore
      .getState()
      .setProjectionLaps([
        lap(2, 3.85),
        lap(6, 3.9),
        lap(1, 3.91),
        lap(4, 3.88),
        lap(5, 3.92),
        lap(3, 3.87),
      ]);
    const view = render(
      <FuelHistory
        fuelUnits="L"
        settings={{ ...settings, fuelHistoryLapCount: 3 }}
      />
    );
    expect(rows()).toEqual([
      ['6', '3.90 L'],
      ['5', '3.92 L'],
      ['4', '3.88 L'],
    ]);
    view.rerender(
      <FuelHistory
        fuelUnits="gal"
        settings={{ ...settings, fuelHistoryLapCount: 5 }}
      />
    );
    expect(rows()).toEqual([
      ['6', '1.03 gal'],
      ['5', '1.04 gal'],
      ['4', '1.02 gal'],
      ['3', '1.02 gal'],
      ['2', '1.02 gal'],
    ]);
  });

  it('supports an arbitrary count and shows fewer rows when fewer laps exist', () => {
    useFuelStore
      .getState()
      .setProjectionLaps(
        Array.from({ length: 12 }, (_, index) => lap(index + 1, 3.9))
      );
    const view = render(
      <FuelHistory
        fuelUnits="L"
        settings={{ ...settings, fuelHistoryLapCount: 8 }}
      />
    );
    expect(rows().map(([number]) => number)).toEqual([
      '12',
      '11',
      '10',
      '9',
      '8',
      '7',
      '6',
      '5',
    ]);
    view.rerender(
      <FuelHistory
        fuelUnits="L"
        settings={{ ...settings, fuelHistoryLapCount: 20 }}
      />
    );
    expect(rows()).toHaveLength(12);
  });

  it.each([
    [undefined, 5],
    [NaN, 5],
    [Infinity, 5],
    [-2, 1],
    [0, 1],
    [7.8, 7],
    [80, 50],
  ])(
    'safely handles a configured count of %s (%s rows)',
    (configured, expected) => {
      useFuelStore
        .getState()
        .setProjectionLaps(
          Array.from({ length: 50 }, (_, index) => lap(index + 1, 3.9))
        );
      render(
        <FuelHistory
          fuelUnits="L"
          settings={{ ...settings, fuelHistoryLapCount: configured }}
        />
      );
      expect(rows()).toHaveLength(expected);
      expect(rows()[0]).toEqual(['50', '3.90 L']);
    }
  );

  it('shows an honest empty state then displays the first completed lap', () => {
    render(<FuelHistory fuelUnits="L" settings={settings} />);
    expect(screen.getByText('Waiting for a completed lap')).toBeInTheDocument();
    act(() => useFuelStore.getState().addLapData(lap(1, 3.9)));
    expect(rows()).toEqual([['1', '3.90 L']]);
    expect(
      screen.queryByText('Waiting for a completed lap')
    ).not.toBeInTheDocument();
  });

  it('excludes saved-session and unusable records while showing measured laps excluded from averages', () => {
    useFuelStore.getState().setLapHistory([lap(10, 9)]);
    useFuelStore
      .getState()
      .setProjectionLaps([
        lap(9, Infinity),
        lap(8, NaN),
        lap(7, -1),
        lap(6, 0),
        lap(0, 2),
        lap(5, 3.9, { isValidForCalc: false, isOutLap: true }),
        lap(4, 3.85, { isGreenFlag: false }),
      ]);
    render(<FuelHistory fuelUnits="L" settings={settings} />);
    expect(rows()).toEqual([
      ['5', '3.90 L'],
      ['4', '3.85 L'],
    ]);
  });

  it('shows an empty table on a session change, then keeps the new lap when numbers restart', () => {
    const qualifying = [
      lap(20, 3.8, { sessionNum: 0, timestamp: 2000 }),
      lap(1, 3.1, { sessionNum: 0, timestamp: 1000 }),
    ];
    useFuelStore.getState().updateSessionInfo(0);
    useFuelStore.getState().setProjectionLaps(qualifying);
    render(<FuelHistory fuelUnits="L" settings={settings} />);
    expect(rows()).toEqual([
      ['20', '3.80 L'],
      ['1', '3.10 L'],
    ]);
    act(() => useFuelStore.getState().updateSessionInfo(1));
    expect(screen.getByText('Waiting for a completed lap')).toBeInTheDocument();
    const firstRaceLap = lap(1, 3.9, { sessionNum: 1, timestamp: 3000 });
    act(() =>
      useFuelStore.getState().setProjectionLaps([firstRaceLap, ...qualifying])
    );
    expect(rows()).toEqual([['1', '3.90 L']]);
    // Both sessions remain in the processor history; the existing calculation map is unaffected.
    expect(useFuelStore.getState().projectionLaps).toEqual([
      firstRaceLap,
      ...qualifying,
    ]);
    expect(useFuelStore.getState().lapHistory.get(1)?.sessionNum).toBe(0);
    act(() => useFuelStore.getState().clearAllData());
    expect(useFuelStore.getState().projectionLaps).toEqual([]);
    expect(screen.getByText('Waiting for a completed lap')).toBeInTheDocument();
  });

  it('orders unknown-session history chronologically without losing repeated lap numbers', () => {
    useFuelStore
      .getState()
      .setProjectionLaps([
        lap(20, 3.8, { sessionNum: 0, timestamp: 2000 }),
        lap(1, 3.9, { sessionNum: 1, timestamp: 3000 }),
        lap(1, 3.1, { sessionNum: 0, timestamp: 1000 }),
      ]);
    render(<FuelHistory fuelUnits="L" settings={settings} />);
    expect(rows()).toEqual([
      ['1', '3.90 L'],
      ['20', '3.80 L'],
      ['1', '3.10 L'],
    ]);
  });

  it('keeps graph defaults and the history visibility setting', () => {
    const view = render(
      <FuelHistory fuelUnits="L" settings={defaultFuelCalculatorSettings} />
    );
    expect(
      view.container.querySelector('[data-widget-id="history-graph"]')
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    view.rerender(
      <FuelHistory
        fuelUnits="L"
        settings={{ ...settings, showFuelHistory: false }}
      />
    );
    expect(view.container).toBeEmptyDOMElement();
  });

  it('labels demo values as a preview and never records them', () => {
    dashboard.isDemoMode = true;
    const view = render(<FuelHistory fuelUnits="L" settings={settings} />);
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(rows()).toHaveLength(5);
    view.rerender(
      <FuelHistory
        fuelUnits="L"
        settings={{ ...settings, fuelHistoryLapCount: 8 }}
      />
    );
    expect(rows()).toHaveLength(8);
    expect(useFuelStore.getState().lapHistory.size).toBe(0);
  });
});
