import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWidgetDefaultConfig } from '@irdashies/types';
import type { Standings } from '@irdashies/domain';
import { BroadcastEvents } from './BroadcastEvents';

const dashboard = vi.hoisted(() => ({ isDemoMode: true }));

vi.mock('@irdashies/context', () => ({
  trackStateSelectors: { sessionFlags: () => 0, sessionNum: () => 0 },
  useTrackStateSelector: () => 0,
  // Demo sessions are usually practice, which this widget hides by default.
  useSessionVisibility: () => false,
  useDashboard: () => ({
    isDemoMode: dashboard.isDemoMode,
    currentDashboard: {
      widgets: [
        {
          id: 'broadcastevents',
          config: getWidgetDefaultConfig('broadcastevents'),
        },
      ],
    },
  }),
}));

vi.mock('@irdashies/domain/standings/useDriverStandings', () => ({
  useDriverStandings: () => [
    [
      '1',
      [
        {
          carIdx: 4,
          classPosition: 2,
          driver: { name: 'Max Driver', carNum: '44' },
          carClass: { id: 1, color: 0xffda59, name: 'GT3' },
        } as Standings,
      ],
    ],
  ],
}));

describe('BroadcastEvents', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows made-up events on real cars in demo mode', () => {
    dashboard.isDemoMode = true;
    render(<BroadcastEvents />);
    expect(screen.queryByText('Incident')).toBeNull();

    act(() => vi.advanceTimersByTime(1000));

    expect(screen.getByText('Incident')).toBeTruthy();
    expect(screen.getByText('MAX DRIVER', { exact: false })).toBeTruthy();
  });

  it('stays empty outside demo mode until something happens', () => {
    dashboard.isDemoMode = false;
    render(<BroadcastEvents />);
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.queryByText('Incident')).toBeNull();
  });
});
