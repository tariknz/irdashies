import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getWidgetDefaultConfig,
  IncidentType,
  type Incident,
} from '@irdashies/types';
import type { Standings } from '@irdashies/domain';
import { BroadcastEvents } from './BroadcastEvents';

const dashboard = vi.hoisted(() => ({ isDemoMode: true, visible: false }));
const excluded = vi.hoisted(() => ({
  idxs: new Set<number>() as ReadonlySet<number>,
  standingsOptions: [] as unknown[],
}));

vi.mock('@irdashies/domain/broadcast/useBroadcastExcludedCarIdxs', () => ({
  useBroadcastExcludedCarIdxs: () => excluded.idxs,
}));

vi.mock('@irdashies/context', () => ({
  trackStateSelectors: { sessionFlags: () => 0, sessionNum: () => 0 },
  useTrackStateSelector: () => 0,
  // Demo sessions are usually practice, which this widget hides by default.
  useSessionVisibility: () => dashboard.visible,
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
  useDriverStandings: (_settings: unknown, options: unknown) => {
    excluded.standingsOptions.push(options);
    return STANDINGS;
  },
}));

const STANDINGS = vi.hoisted(() => [
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
]) as unknown as [string, Standings[]][];

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

  describe('excluded cars', () => {
    let listener: ((incident: Incident) => void) | undefined;

    beforeEach(() => {
      dashboard.isDemoMode = false;
      dashboard.visible = true;
      excluded.standingsOptions = [];
      listener = undefined;
      window.channelBridge = {
        subscribe: (_channel: string, cb: (incident: Incident) => void) => {
          listener = cb;
          return () => undefined;
        },
      } as unknown as typeof window.channelBridge;
    });

    afterEach(() => {
      dashboard.visible = false;
      excluded.idxs = new Set();
      window.channelBridge =
        undefined as unknown as typeof window.channelBridge;
    });

    const crash = (carIdx: number) =>
      ({
        id: `crash-${carIdx}`,
        type: IncidentType.Crash,
        carIdx,
        carNumber: '44',
        driverName: 'Max Driver',
        lapNum: 3,
      }) as unknown as Incident;

    it('passes the excluded set to the standings', () => {
      excluded.idxs = new Set([7]);
      render(<BroadcastEvents />);
      expect(excluded.standingsOptions.at(-1)).toMatchObject({
        showAll: true,
        excludedCarIdxs: excluded.idxs,
      });
    });

    it('drops an incident on an excluded car', () => {
      excluded.idxs = new Set([4]);
      render(<BroadcastEvents />);
      act(() => listener?.(crash(4)));
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.queryByText('Incident')).toBeNull();
    });

    it('still shows an incident on a competitor', () => {
      excluded.idxs = new Set([9]);
      render(<BroadcastEvents />);
      act(() => listener?.(crash(4)));
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.getByText('Incident')).toBeTruthy();
    });
  });
});
