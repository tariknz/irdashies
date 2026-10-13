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
    render(<FuelHistory fuelUnits="L" settings={settings} />);
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(rows()).toHaveLength(5);
    expect(useFuelStore.getState().lapHistory.size).toBe(0);
  });
});
