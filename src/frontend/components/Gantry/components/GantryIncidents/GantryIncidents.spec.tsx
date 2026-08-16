import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IncidentType, type Incident } from '@irdashies/types';

const trackState = vi.hoisted(() => ({
  snapshot: undefined as { isReplayPlaying: boolean } | undefined,
}));

vi.mock('@irdashies/context', () => ({
  useRaceControlStore: (selector: (state: unknown) => unknown) =>
    selector({
      activeTypeFilters: new Set(Object.values(IncidentType)),
      toggleTypeFilter: vi.fn(),
      driverFilter: null,
      setDriverFilter: vi.fn(),
      incidents: [],
    }),
  useFilteredIncidents: () => [incident],
  // Mirrors the real selector contract: undefined until a snapshot arrives.
  useTrackStateSelector: (selector: (snapshot: unknown) => unknown) =>
    trackState.snapshot === undefined
      ? undefined
      : selector(trackState.snapshot),
}));

const incident: Incident = {
  id: 'incident-1',
  carIdx: 4,
  driverName: 'Vogel',
  carNumber: '7',
  teamName: '',
  sessionNum: 0,
  sessionTime: 120,
  lapNum: 3,
  replayFrameNum: 900,
  type: IncidentType.Crash,
  lapDistPct: 0.5,
  timestamp: 0,
};

const { GantryIncidents } = await import('./GantryIncidents');

const replayButtons = () =>
  screen.getAllByRole('button', { name: /^-\d+s$/ }) as HTMLButtonElement[];

describe('GantryIncidents replay state', () => {
  beforeEach(() => {
    trackState.snapshot = undefined;
  });

  it('enables the replay buttons when the track-state snapshot says a replay is playing', () => {
    trackState.snapshot = { isReplayPlaying: true };
    render(<GantryIncidents />);

    expect(replayButtons().length).toBeGreaterThan(0);
    replayButtons().forEach((button) => expect(button.disabled).toBe(false));
  });

  it('disables the replay buttons while the sim is live', () => {
    trackState.snapshot = { isReplayPlaying: false };
    render(<GantryIncidents />);

    replayButtons().forEach((button) => expect(button.disabled).toBe(true));
    expect(screen.getByText(/replay unavailable/i)).toBeTruthy();
  });

  it('does not retain stale replay state when the snapshot goes missing', () => {
    trackState.snapshot = { isReplayPlaying: true };
    const { unmount } = render(<GantryIncidents />);
    replayButtons().forEach((button) => expect(button.disabled).toBe(false));
    unmount();

    trackState.snapshot = undefined;
    render(<GantryIncidents />);

    replayButtons().forEach((button) => expect(button.disabled).toBe(true));
  });
});
