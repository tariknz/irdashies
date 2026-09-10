import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock('../logger', () => ({
  default: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

import {
  createSessionProfileSwitcher,
  SPOTTING_DWELL_MS,
} from './sessionProfileSwitcher';
import type { SessionProfileMap } from '@irdashies/types';
import type { SessionLifecycle } from '../sessionLifecycle';

/**
 * A stand-in lifecycle that lets a test drive the two events the switcher
 * listens to, without needing telemetry frames.
 *
 * `initialState` is what the real lifecycle has already resolved by the time a
 * subscriber attaches. It defaults to nothing known, which is the app starting
 * before iRacing does.
 */
const makeLifecycle = (
  initialState: {
    sessionType?: string;
    isDriving?: boolean;
  } = {}
) => {
  const typeCallbacks = new Set<(sessionType: string) => void>();
  const drivingCallbacks = new Set<(isDriving: boolean) => void>();
  const disconnectCallbacks = new Set<() => void>();

  const lifecycle = {
    onSessionTypeChange: (cb: (sessionType: string) => void) => {
      typeCallbacks.add(cb);
      return () => typeCallbacks.delete(cb);
    },
    onDrivingStateChange: (cb: (isDriving: boolean) => void) => {
      drivingCallbacks.add(cb);
      return () => drivingCallbacks.delete(cb);
    },
    onDisconnect: (cb: () => void) => {
      disconnectCallbacks.add(cb);
      return () => disconnectCallbacks.delete(cb);
    },
    getCurrentState: () => ({
      sessionType: initialState.sessionType,
      isDriving: initialState.isDriving,
    }),
  } as unknown as SessionLifecycle;

  return {
    lifecycle,
    emitSessionType: (sessionType: string) =>
      typeCallbacks.forEach((cb) => cb(sessionType)),
    emitDriving: (isDriving: boolean) =>
      drivingCallbacks.forEach((cb) => cb(isDriving)),
    emitDisconnect: () => disconnectCallbacks.forEach((cb) => cb()),
    subscriberCount: () =>
      typeCallbacks.size + drivingCallbacks.size + disconnectCallbacks.size,
  };
};

const setup = (
  map: SessionProfileMap,
  {
    currentProfileId = 'default',
    existingProfiles = ['default', 'quali', 'race', 'spotter'],
    initialState = {},
  }: {
    currentProfileId?: string;
    existingProfiles?: string[];
    initialState?: { sessionType?: string; isDriving?: boolean };
  } = {}
) => {
  const harness = makeLifecycle(initialState);
  const switchProfile = vi.fn();
  let current = currentProfileId;
  switchProfile.mockImplementation((profileId: string) => {
    current = profileId;
  });

  const switcher = createSessionProfileSwitcher({
    lifecycle: harness.lifecycle,
    getMap: () => map,
    getCurrentProfileId: () => current,
    profileExists: (profileId) => existingProfiles.includes(profileId),
    switchProfile,
  });

  return { ...harness, switcher, switchProfile };
};

describe('sessionProfileSwitcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockLoggerInfo.mockReset();
    mockLoggerWarn.mockReset();
    mockLoggerError.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('session types', () => {
    it('switches to the profile mapped to the new session type', () => {
      const { emitSessionType, switchProfile } = setup({ race: 'race' });

      emitSessionType('Race');

      expect(switchProfile).toHaveBeenCalledWith('race');
    });

    it('leaves the profile alone for a session type with no mapping', () => {
      const { emitSessionType, switchProfile } = setup({ race: 'race' });

      emitSessionType('Practice');

      expect(switchProfile).not.toHaveBeenCalled();
    });

    it('leaves the profile alone for an unrecognised session type', () => {
      const { emitSessionType, switchProfile } = setup({
        race: 'race',
        practice: 'default',
      });

      emitSessionType('Team Enduro Shootout');

      expect(switchProfile).not.toHaveBeenCalled();
    });

    it('does not switch when already on the mapped profile', () => {
      const { emitSessionType, switchProfile } = setup(
        { race: 'race' },
        { currentProfileId: 'race' }
      );

      emitSessionType('Race');

      expect(switchProfile).not.toHaveBeenCalled();
    });

    it('does not switch to a profile that has been deleted', () => {
      const { emitSessionType, switchProfile } = setup(
        { race: 'deleted-profile' },
        { existingProfiles: ['default'] }
      );

      emitSessionType('Race');

      expect(switchProfile).not.toHaveBeenCalled();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('no longer exists')
      );
    });

    it('treats a time trial as its own trigger, not as practice', () => {
      const { emitSessionType, switchProfile } = setup({
        practice: 'default',
        timeTrial: 'quali',
      });

      // iRacing reports a time trial as 'Lone Practice'.
      emitSessionType('Lone Practice');

      expect(switchProfile).toHaveBeenCalledWith('quali');
    });

    it('carries the previous profile into a session that has no mapping', () => {
      // Practice is mapped, qualifying is not. The qualifying session leaves
      // the practice profile in place rather than reverting to anything.
      const { emitSessionType, switchProfile } = setup({ practice: 'quali' });

      emitSessionType('Practice');
      switchProfile.mockClear();
      emitSessionType('Open Qualify');

      expect(switchProfile).not.toHaveBeenCalled();
    });

    it('switches into a mapped session even when the previous one had none', () => {
      const { emitSessionType, switchProfile } = setup({ race: 'race' });

      emitSessionType('Practice');
      expect(switchProfile).not.toHaveBeenCalled();

      emitSessionType('Race');

      expect(switchProfile).toHaveBeenCalledWith('race');
    });

    it('returns to a mapped session type after an unmapped one', () => {
      // The full round trip: an unmapped session in the middle does not
      // prevent the next mapped one from applying.
      const { emitSessionType, switchProfile } = setup({
        practice: 'default',
        race: 'race',
      });

      emitSessionType('Race');
      emitSessionType('Lone Qualify');
      emitSessionType('Practice');

      expect(switchProfile.mock.calls).toEqual([['race'], ['default']]);
    });

    it('follows the event from qualifying into the race', () => {
      const { emitSessionType, switchProfile } = setup({
        openQualify: 'quali',
        race: 'race',
      });

      emitSessionType('Open Qualify');
      emitSessionType('Race');

      expect(switchProfile.mock.calls).toEqual([['quali'], ['race']]);
    });
  });

  describe('spotting', () => {
    it('applies the spotting profile once the player has been out of the car', () => {
      const { emitSessionType, emitDriving, switchProfile } = setup({
        race: 'race',
        spotting: 'spotter',
      });
      emitSessionType('Race');
      switchProfile.mockClear();

      emitDriving(false);
      expect(switchProfile).not.toHaveBeenCalled();

      vi.advanceTimersByTime(SPOTTING_DWELL_MS);
      expect(switchProfile).toHaveBeenCalledWith('spotter');
    });

    it('ignores a brief hop out of the car', () => {
      const { emitSessionType, emitDriving, switchProfile } = setup({
        race: 'race',
        spotting: 'spotter',
      });
      emitSessionType('Race');
      switchProfile.mockClear();

      emitDriving(false);
      vi.advanceTimersByTime(SPOTTING_DWELL_MS - 1);
      emitDriving(true);
      vi.advanceTimersByTime(SPOTTING_DWELL_MS);

      expect(switchProfile).not.toHaveBeenCalled();
    });

    it('hands back to the session profile as soon as the player drives', () => {
      const { emitSessionType, emitDriving, switchProfile } = setup({
        race: 'race',
        spotting: 'spotter',
      });
      emitSessionType('Race');
      emitDriving(false);
      vi.advanceTimersByTime(SPOTTING_DWELL_MS);
      switchProfile.mockClear();

      emitDriving(true);

      expect(switchProfile).toHaveBeenCalledWith('race');
    });

    it('outranks the session type when the session changes while spotting', () => {
      const { emitSessionType, emitDriving, switchProfile } = setup({
        practice: 'default',
        race: 'race',
        spotting: 'spotter',
      });
      emitDriving(false);
      vi.advanceTimersByTime(SPOTTING_DWELL_MS);
      switchProfile.mockClear();

      emitSessionType('Race');

      expect(switchProfile).not.toHaveBeenCalledWith('race');
    });

    it('falls back to the session profile when spotting is unmapped', () => {
      const { emitSessionType, emitDriving, switchProfile } = setup({
        race: 'race',
      });
      emitSessionType('Race');
      emitDriving(false);
      vi.advanceTimersByTime(SPOTTING_DWELL_MS);
      switchProfile.mockClear();

      emitDriving(true);

      // Already on 'race' and nothing else applies, so nothing to do.
      expect(switchProfile).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('forgets the session after a disconnect', () => {
      const { emitSessionType, emitDisconnect, emitDriving, switchProfile } =
        setup({ race: 'race', spotting: 'spotter' });
      emitSessionType('Race');
      emitDriving(false);
      vi.advanceTimersByTime(SPOTTING_DWELL_MS);
      switchProfile.mockClear();

      emitDisconnect();
      emitDriving(true);

      // iRacing has gone away, so there is no session type to return to. The
      // switcher must not drag the last event's race profile into whatever
      // the user does next.
      expect(switchProfile).not.toHaveBeenCalled();
    });

    it('cancels a pending dwell when disposed', () => {
      const { emitDriving, switcher, switchProfile } = setup({
        spotting: 'spotter',
      });

      emitDriving(false);
      switcher.dispose();
      vi.advanceTimersByTime(SPOTTING_DWELL_MS);

      expect(switchProfile).not.toHaveBeenCalled();
    });

    it('unsubscribes from the lifecycle when disposed', () => {
      const { switcher, subscriberCount } = setup({ race: 'race' });
      expect(subscriberCount()).toBe(3);

      switcher.dispose();

      expect(subscriberCount()).toBe(0);
    });

    it('keeps working when switching throws', () => {
      const harness = makeLifecycle();
      const switchProfile = vi.fn(() => {
        throw new Error('profile store is busy');
      });
      createSessionProfileSwitcher({
        lifecycle: harness.lifecycle,
        getMap: () => ({ race: 'race' }),
        getCurrentProfileId: () => 'default',
        profileExists: () => true,
        switchProfile,
      });

      expect(() => harness.emitSessionType('Race')).not.toThrow();
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  /**
   * The lifecycle's callbacks carry transitions and are never replayed, and the
   * SDK is already publishing by the time main.ts gets here. Everything below
   * describes starting irDashies while iRacing is mid-session — the ordinary
   * case of alt-tabbing out to launch the overlay.
   */
  describe('starting up mid-session', () => {
    it('applies the mapped profile for the session already under way', () => {
      const { switchProfile } = setup(
        { race: 'race' },
        { initialState: { sessionType: 'Race', isDriving: true } }
      );

      expect(switchProfile).toHaveBeenCalledWith('race');
    });

    it('applies the spotting profile when started out of the car', () => {
      const { switchProfile } = setup(
        { race: 'race', spotting: 'spotter' },
        { initialState: { sessionType: 'Race', isDriving: false } }
      );

      // Without waiting out the dwell: it exists to ride out brief hops out of
      // the car, and someone already out when the app launched has been out for
      // longer than the app has existed.
      expect(switchProfile).toHaveBeenCalledWith('spotter');
      expect(switchProfile).toHaveBeenCalledTimes(1);
    });

    it('leaves the profile alone when nothing has resolved yet', () => {
      const { switchProfile } = setup({ race: 'race', spotting: 'spotter' });

      expect(switchProfile).not.toHaveBeenCalled();
    });

    it('leaves the profile alone when the running session is unmapped', () => {
      const { switchProfile } = setup(
        { race: 'race' },
        { initialState: { sessionType: 'Practice', isDriving: true } }
      );

      expect(switchProfile).not.toHaveBeenCalled();
    });

    it('does not fight a profile that already matches the mapping', () => {
      const { switchProfile } = setup(
        { race: 'race' },
        {
          currentProfileId: 'race',
          initialState: { sessionType: 'Race', isDriving: true },
        }
      );

      expect(switchProfile).not.toHaveBeenCalled();
    });

    /**
     * The reported symptom behind all of this: a session whose type never
     * changes after the app attaches. Practice through to a warmup that iRacing
     * also reports as Practice fires nothing, so an unseeded switcher held no
     * session key at all and could only ever apply the spotting profile.
     */
    it('recovers from spotting into a session that never fires a change', () => {
      const { emitDriving, switchProfile } = setup(
        { practice: 'default', spotting: 'spotter' },
        {
          currentProfileId: 'spotter',
          initialState: { sessionType: 'Practice', isDriving: false },
        }
      );
      switchProfile.mockClear();

      emitDriving(true);

      expect(switchProfile).toHaveBeenCalledWith('default');
    });
  });
});
