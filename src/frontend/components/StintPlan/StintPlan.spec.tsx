import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RacePlanProgressSnapshot } from '@irdashies/types';
import { demoRacePlanSnapshot, demoRacePlanState } from '@irdashies/domain';
import { StintPlan } from './StintPlan';

const mocks = vi.hoisted(() => ({
  snapshot: undefined as RacePlanProgressSnapshot | undefined,
}));

vi.mock('@irdashies/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@irdashies/context')>()),
  useDashboard: () => ({ isDemoMode: false }),
  useRacePlanProgressSnapshot: () => mocks.snapshot,
  useRacePlanState: () => demoRacePlanState,
}));

describe('StintPlan', () => {
  beforeEach(() => {
    mocks.snapshot = undefined;
  });

  it('shows the stint, laps, fuel, next driver and drift', () => {
    mocks.snapshot = demoRacePlanSnapshot({ driftSec: 134, fuelPerLap: 1.08 });
    render(<StintPlan showElapsedTime={false} />);
    expect(screen.getByText('Stint 4/23')).toBeTruthy();
    expect(screen.getByText('Driver D')).toBeTruthy();
    expect(screen.getByText('Lap 13 of 34')).toBeTruthy();
    expect(screen.getByText('Box in 21')).toBeTruthy();
    expect(screen.getByText('1.05')).toBeTruthy();
    expect(screen.getByText('1.08')).toBeTruthy();
    expect(screen.getByText('Driver E')).toBeTruthy();
    expect(screen.getByText('+2:14 behind plan')).toBeTruthy();
  });

  it('highlights the box lap', () => {
    mocks.snapshot = demoRacePlanSnapshot({ lapsInStint: 33 });
    render(<StintPlan />);
    expect(screen.getByText('Box this lap').className).toContain('bg-amber');
  });

  it('leaves the fuel row out when the fuel cannot be seen', () => {
    mocks.snapshot = demoRacePlanSnapshot({ fuelVisible: false });
    render(<StintPlan />);
    expect(screen.queryByText('Target')).toBeNull();
  });

  it('shows a clash icon when a stint clashes', () => {
    mocks.snapshot = demoRacePlanSnapshot({ driftSec: 900 });
    render(<StintPlan />);
    expect(
      screen.getByRole('img', { name: '1 clash with driver availability' })
    ).toBeTruthy();
  });

  it('points to the settings without a plan', () => {
    mocks.snapshot = { ...demoRacePlanSnapshot(), status: 'no-plan' };
    render(<StintPlan />);
    expect(screen.getByText('No race plan loaded')).toBeTruthy();
    expect(
      screen.getByText('Set up a race plan in Settings → Race Plan')
    ).toBeTruthy();
  });

  it('warns about a plan for another team', () => {
    mocks.snapshot = demoRacePlanSnapshot({ mismatches: ['team'] });
    render(<StintPlan />);
    expect(screen.getByText('This plan is for a different team')).toBeTruthy();
  });

  it('waits for data', () => {
    render(<StintPlan />);
    expect(screen.getByText('Waiting for race plan data')).toBeTruthy();
  });
});
