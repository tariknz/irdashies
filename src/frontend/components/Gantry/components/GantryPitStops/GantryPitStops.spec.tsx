import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { PitStopsView } from './GantryPitStops';
import { demoPitStopData } from './pitStopsDemo';

const renderView = (
  overrides: Partial<Parameters<typeof PitStopsView>[0]> = {}
) => {
  const props = {
    data: demoPitStopData(),
    followedCarIdx: null,
    classFilter: null,
    onClassFilterChange: vi.fn(),
    mode: 'stops' as const,
    onModeChange: vi.fn(),
    teamFilter: null,
    onTeamFilterChange: vi.fn(),
    ...overrides,
  };
  render(<PitStopsView {...props} />);
  return props;
};

const bodyRows = () =>
  within(screen.getAllByRole('table')[0]).getAllByRole('row').slice(1);

describe('PitStopsView', () => {
  it("starts on the player's class", () => {
    renderView();
    // Twelve Clios with three stops each, plus one still in the pits.
    expect(bodyRows()).toHaveLength(37);
    expect(screen.queryByText('GT4', { selector: 'td' })).toBeNull();
  });

  it('lists every class with All', () => {
    renderView({ classFilter: 'all' });
    expect(bodyRows()).toHaveLength(37 + 13);
    expect(
      screen.getAllByText('GT4', { selector: 'td' }).length
    ).toBeGreaterThan(0);
  });

  it('shows cars still in the pit lane', () => {
    renderView();
    expect(screen.getByText('In pit lane')).toBeTruthy();
    expect(screen.getAllByText('In pits').length).toBeGreaterThan(0);
  });

  it("filters to one team's stops", () => {
    renderView({ teamFilter: 2 });
    expect(bodyRows()).toHaveLength(3);
  });

  it('marks a drive-through', () => {
    renderView({ classFilter: '2' });
    expect(screen.getByText('Drive-through')).toBeTruthy();
  });

  it('expands a team to its stops', () => {
    renderView({ mode: 'teams' });
    const team = screen.getByText('Team D');
    fireEvent.click(team);
    expect(screen.getAllByRole('table')).toHaveLength(2);
  });

  it('asks the Gantry to switch view', () => {
    const props = renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Teams' }));
    expect(props.onModeChange).toHaveBeenCalledWith('teams');
  });

  it('does not show an estimated service', () => {
    renderView();
    expect(screen.queryByText(/estimate/i)).toBeNull();
    expect(screen.queryByText(/tyres/i)).toBeNull();
  });

  it('disables the replay buttons while the sim is live', () => {
    renderView();
    const buttons = screen.getAllByRole('button', { name: '-5s' });
    buttons.forEach((button) =>
      expect(button).toHaveProperty('disabled', true)
    );
  });

  it('jumps the replay to 5s before the car reached its pit box', () => {
    const replayPitStop = vi.fn(() => Promise.resolve());
    Object.defineProperty(window, 'raceControlBridge', {
      configurable: true,
      value: { replayPitStop },
    });
    renderView({ teamFilter: 2, isReplayPlaying: true });
    // Newest first: car 2's third stop, on lap 56.
    fireEvent.click(screen.getAllByRole('button', { name: '-5s' })[0]);
    expect(replayPitStop).toHaveBeenCalledWith(
      {
        sessionNum: 2,
        sessionTime: 56 * 136 + 2 * 3 + 11,
        carNumber: '12',
        carIdx: 2,
        driverName: 'Driver 2-3',
      },
      5
    );
  });

  it('says when there are no stops', () => {
    renderView({ data: demoPitStopData({ empty: true }) });
    expect(screen.getByText('No pit stops yet.')).toBeTruthy();
  });
});
