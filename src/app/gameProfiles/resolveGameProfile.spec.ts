import { describe, expect, it } from 'vitest';
import type { GameProfileAssignments } from '@irdashies/types';
import {
  gameProfileIdsFor,
  nextCycledProfileId,
  profileIdForSimulatorChoice,
  resolveActiveGameProfile,
} from './resolveGameProfile';

const profileIds = { iracing: 'iracing', lmu: 'lmu' } as const;

const resolve = (
  processes: { id: 'iracing' | 'lmu'; startedAt: number }[],
  previousProfileId = 'default'
) =>
  resolveActiveGameProfile({
    processes,
    previousProfileId,
    profileIds,
  });

describe('resolveActiveGameProfile', () => {
  it('keeps the previous profile when nothing is running', () => {
    expect(resolve([], 'iracing')).toEqual({
      profileId: 'iracing',
      activeGame: null,
    });
    expect(resolve([])).toEqual({
      profileId: 'default',
      activeGame: null,
    });
  });

  it('switches to the only running game', () => {
    expect(resolve([{ id: 'iracing', startedAt: 10 }])).toEqual({
      profileId: 'iracing',
      activeGame: 'iracing',
    });
    expect(resolve([{ id: 'lmu', startedAt: 10 }], 'iracing')).toEqual({
      profileId: 'lmu',
      activeGame: 'lmu',
    });
  });

  it('switches from the game that closed to the one still running', () => {
    expect(resolve([{ id: 'lmu', startedAt: 50 }], 'iracing')).toEqual({
      profileId: 'lmu',
      activeGame: 'lmu',
    });
  });

  it('uses the game that started first when both are running', () => {
    expect(
      resolve([
        { id: 'lmu', startedAt: 200 },
        { id: 'iracing', startedAt: 100 },
      ])
    ).toEqual({ profileId: 'iracing', activeGame: 'iracing' });

    expect(
      resolve(
        [
          { id: 'iracing', startedAt: 200 },
          { id: 'lmu', startedAt: 100 },
        ],
        'iracing'
      )
    ).toEqual({ profileId: 'lmu', activeGame: 'lmu' });
  });

  it('keeps one profile when both games run — the layout is singular', () => {
    const decision = resolve([
      { id: 'iracing', startedAt: 1 },
      { id: 'lmu', startedAt: 2 },
    ]);
    expect(decision.activeGame).toBe('iracing');
    expect(decision.profileId).toBe('iracing');
  });

  it('uses the earliest start when the same game has more than one process', () => {
    expect(
      resolve([
        { id: 'iracing', startedAt: 300 },
        { id: 'iracing', startedAt: 50 },
        { id: 'lmu', startedAt: 100 },
      ])
    ).toEqual({ profileId: 'iracing', activeGame: 'iracing' });
  });

  it('keeps the previous profile when both games share a start time', () => {
    expect(
      resolve(
        [
          { id: 'iracing', startedAt: 10 },
          { id: 'lmu', startedAt: 10 },
        ],
        'lmu'
      )
    ).toEqual({ profileId: 'lmu', activeGame: 'lmu' });
  });

  it('picks iRacing when a start-time tie has no previous game profile', () => {
    expect(
      resolve([
        { id: 'lmu', startedAt: 10 },
        { id: 'iracing', startedAt: 10 },
      ])
    ).toEqual({ profileId: 'iracing', activeGame: 'iracing' });
  });

  it('loads the profile configured for that game', () => {
    expect(
      resolveActiveGameProfile({
        processes: [{ id: 'lmu', startedAt: 10 }],
        previousProfileId: 'default',
        profileIds: { iracing: 'race-layout', lmu: 'endurance' },
      })
    ).toEqual({ profileId: 'endurance', activeGame: 'lmu' });
  });
});

describe('gameProfileIdsFor', () => {
  const exists = (id: string) => id !== 'gone';

  it('uses the default profile when nothing has been chosen', () => {
    expect(gameProfileIdsFor(undefined, exists, {})).toEqual({
      iracing: 'default',
      lmu: 'default',
    });
  });

  it('uses an assigned stored default', () => {
    expect(
      gameProfileIdsFor({ iracing: 'race-layout', lmu: 'endurance' }, exists, {
        'race-layout': ['iracing'],
        endurance: ['lmu'],
      })
    ).toEqual({ iracing: 'race-layout', lmu: 'endurance' });
  });

  it('ignores an unassigned stored default and falls back to default', () => {
    expect(
      gameProfileIdsFor(
        { iracing: 'race-layout', lmu: 'endurance' },
        exists,
        {}
      )
    ).toEqual({ iracing: 'default', lmu: 'default' });
  });

  it('falls back to default when the stored profile is gone', () => {
    expect(
      gameProfileIdsFor({ iracing: 'gone' }, exists, { gone: ['iracing'] })
    ).toEqual({
      iracing: 'default',
      lmu: 'default',
    });
  });
});

describe('profileIdForSimulatorChoice', () => {
  const exists = (id: string) => id !== 'gone';

  it('does not switch for auto', () => {
    expect(
      profileIdForSimulatorChoice('auto', { lmu: 'endurance' }, exists, {
        endurance: ['lmu'],
      })
    ).toBeUndefined();
  });

  it('uses the assigned stored default for the game that was chosen', () => {
    const stored = { iracing: 'race-layout', lmu: 'endurance' };
    const assignments: GameProfileAssignments = {
      'race-layout': ['iracing'],
      endurance: ['lmu'],
    };
    expect(
      profileIdForSimulatorChoice('lmu', stored, exists, assignments)
    ).toBe('endurance');
    expect(
      profileIdForSimulatorChoice('iracing', stored, exists, assignments)
    ).toBe('race-layout');
  });

  it('falls back to the default profile when the stored one is not assigned', () => {
    expect(
      profileIdForSimulatorChoice(
        'lmu',
        { lmu: 'endurance' },
        exists,
        {}
      )
    ).toBe('default');
  });

  it('falls back to the default profile when nothing is stored', () => {
    expect(profileIdForSimulatorChoice('iracing', undefined, exists, {})).toBe(
      'default'
    );
  });

  it('switches to nothing when that profile does not exist', () => {
    const noDefault = (id: string) => id === 'endurance';
    expect(
      profileIdForSimulatorChoice('lmu', { lmu: 'gone' }, noDefault, {
        gone: ['lmu'],
      })
    ).toBeUndefined();
  });
});

describe('nextCycledProfileId', () => {
  const profileIds = ['default', 'quali', 'pit', 'race', 'spot'];
  const assignments: GameProfileAssignments = {
    quali: ['iracing'],
    race: ['iracing', 'lmu'],
    spot: ['lmu'],
  };

  const step = (
    currentId: string,
    direction: 1 | -1,
    runningGame: 'iracing' | 'lmu' | null,
    cycle = true
  ) =>
    nextCycledProfileId({
      profileIds,
      currentId,
      direction,
      cycle,
      runningGame,
      assignments,
    });

  it('walks only the running game and every profile when nothing is running', () => {
    expect(step('quali', 1, 'iracing')).toBe('race');
    expect(step('race', 1, 'iracing')).toBe('default');
    expect(step('race', 1, 'iracing', false)).toBeNull();
    expect(step('spot', 1, 'lmu')).toBe('default');
    expect(step('quali', 1, null, false)).toBe('pit');
    expect(step('race', 1, null, false)).toBe('spot');
  });

  it('includes an assigned default and enters the set from outside', () => {
    const withDefault: GameProfileAssignments = {
      ...assignments,
      default: ['iracing'],
    };
    const go = (currentId: string, direction: 1 | -1, cycle = false) =>
      nextCycledProfileId({
        profileIds,
        currentId,
        direction,
        cycle,
        runningGame: 'iracing',
        assignments: withDefault,
      });
    expect(go('quali', -1)).toBe('default');
    expect(go('pit', 1)).toBe('default');
    expect(go('pit', -1)).toBe('race');
    expect(go('race', 1, true)).toBe('default');
  });

  it('counts the built-in profile as assigned to its game', () => {
    expect(
      nextCycledProfileId({
        profileIds: ['iracing', 'quali'],
        currentId: 'quali',
        direction: 1,
        cycle: true,
        runningGame: 'iracing',
        assignments: { quali: ['iracing'] },
      })
    ).toBe('iracing');
  });

  it('includes default for a running game and skips a profile assigned to none', () => {
    const ids = ['orphan', 'default', 'race'];
    const assigned: GameProfileAssignments = { race: ['iracing'] };
    const go = (
      currentId: string,
      runningGame: 'iracing' | 'lmu',
      cycle = true
    ) =>
      nextCycledProfileId({
        profileIds: ids,
        currentId,
        direction: 1,
        cycle,
        runningGame,
        assignments: assigned,
      });

    expect(go('default', 'iracing', false)).toBe('race');
    expect(go('race', 'iracing')).toBe('default');
    expect(go('orphan', 'lmu')).toBe('default');
  });

  it('stays put when default is the only profile assigned to the running game', () => {
    expect(
      nextCycledProfileId({
        profileIds,
        currentId: 'default',
        direction: 1,
        cycle: true,
        runningGame: 'iracing',
        assignments: {},
      })
    ).toBeNull();
  });
});
