import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RacePlanProgressSnapshot } from '@irdashies/types';
import {
  DEMO_DRIVER_IDS,
  demoRacePlanSnapshot,
  demoRacePlanState,
  demoRepairStop,
} from '@irdashies/domain';
import { StrategyTimeline } from './StrategyTimeline';

const mocks = vi.hoisted(() => ({
  snapshot: undefined as RacePlanProgressSnapshot | undefined,
}));

vi.mock('@irdashies/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@irdashies/context')>()),
  useDashboard: () => ({ isDemoMode: false }),
  useRacePlanProgressSnapshot: () => mocks.snapshot,
  useRacePlanState: () => demoRacePlanState,
  useDriverUserId: () => DEMO_DRIVER_IDS[1],
}));

describe('StrategyTimeline', () => {
  beforeEach(() => {
    mocks.snapshot = undefined;
  });

  it('lists every stint with its status', () => {
    mocks.snapshot = demoRacePlanSnapshot({
      unassignedExtra: true,
      dropLast: true,
      rebuiltFrom: 5,
    });
    render(<StrategyTimeline />);
    expect(screen.getAllByRole('row')).toHaveLength(1 + 24);
    for (const label of [
      'Done',
      'In car',
      'Upcoming',
      'Unassigned',
      'Dropped',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(
      screen.getAllByRole('img', { name: 'Rebuilt after a stop' }).length
    ).toBe(20);
  });

  it('says when my next stint is', () => {
    mocks.snapshot = demoRacePlanSnapshot();
    render(<StrategyTimeline />);
    expect(screen.getByText(/^Your next stint in /)).toBeTruthy();
  });

  it('marks clashes with a tooltip', () => {
    mocks.snapshot = demoRacePlanSnapshot({ driftSec: 900 });
    render(<StrategyTimeline />);
    expect(
      screen.getByRole('img', { name: /, unavailable from/ })
    ).toBeTruthy();
    expect(
      screen.getByRole('img', { name: /, maybe unavailable from/ })
    ).toBeTruthy();
  });

  it('lists unplanned stops and can hide them', () => {
    mocks.snapshot = demoRacePlanSnapshot({ stops: [demoRepairStop] });
    const { rerender } = render(<StrategyTimeline />);
    expect(
      screen.getByText('Stop lap 60: no fuel, no driver change')
    ).toBeTruthy();
    rerender(<StrategyTimeline showStops={false} />);
    expect(screen.queryByText('Unplanned stops')).toBeNull();
  });

  it('can leave finished stints out', () => {
    mocks.snapshot = demoRacePlanSnapshot();
    render(<StrategyTimeline showDoneStints={false} />);
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('shows a notice in a replay', () => {
    mocks.snapshot = { ...demoRacePlanSnapshot(), status: 'replay' };
    render(<StrategyTimeline />);
    expect(
      screen.getByText('Race plan is not tracked in replays')
    ).toBeTruthy();
  });
});
