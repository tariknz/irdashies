import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Standings } from '@irdashies/domain';
import { SessionState } from '@irdashies/types';
import { BroadcastPodium } from './BroadcastPodium';

const ctx = vi.hoisted(() => ({ isDemoMode: false, state: 0 }));

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({ isDemoMode: ctx.isDemoMode }),
  useSessionTimeTiming: () => ({ sessionType: 'Race', state: ctx.state }),
}));
vi.mock('@irdashies/domain/standings/useDriverStandings', () => ({
  useDriverStandings: () => [
    [
      '1',
      [
        {
          carIdx: 0,
          classPosition: 1,
          driver: { name: 'Ann Winner', carNum: '7' },
          carClass: { id: 1, color: 0xffffff, name: 'GTP' },
        } as unknown as Standings,
      ],
    ],
  ],
}));
vi.mock('../shared/CarManufacturer/CarManufacturer', () => ({
  CarManufacturer: () => null,
}));

describe('BroadcastPodium', () => {
  it('stays hidden while the race is running', () => {
    ctx.state = SessionState.Racing;
    render(<BroadcastPodium />);
    expect(screen.queryByText('Podium')).not.toBeInTheDocument();
  });

  it('shows after the checkered flag', () => {
    ctx.state = SessionState.Checkered;
    render(<BroadcastPodium />);
    expect(screen.getByText('Podium')).toBeInTheDocument();
  });

  it('shows in demo mode so it can be placed', () => {
    ctx.state = SessionState.Racing;
    ctx.isDemoMode = true;
    render(<BroadcastPodium />);
    expect(screen.getByText('Podium')).toBeInTheDocument();
  });
});
