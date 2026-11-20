import type { SessionProfileMap, ProfileTriggerKey } from '@irdashies/types';
import { sessionProfileKeyFor, SPOTTING_TRIGGER_KEY } from '@irdashies/types';
import type { SessionLifecycle } from '../sessionLifecycle';
import logger from '../logger';

/**
 * How long the player must stay out of the car before the spotting profile
 * applies. Getting out is not instantaneous or always deliberate — a tow, a
 * quick garage visit, the moment between a swap — and switching the whole
 * overlay layout on every blip would be worse than switching a little late.
 * Getting back in reverts immediately; only the outbound edge waits.
 */
export const SPOTTING_DWELL_MS = 20_000;

export interface SessionProfileSwitcherDeps {
  lifecycle: SessionLifecycle;
  /** Read fresh on every decision, so edits in settings take effect at once. */
  getMap: () => SessionProfileMap;
  getCurrentProfileId: () => string;
  profileExists: (profileId: string) => boolean;
  switchProfile: (profileId: string) => void;
  dwellMs?: number;
}

export interface SessionProfileSwitcher {
  dispose: () => void;
}

/**
 * Switches the active profile as an event moves between session types, so a
 * layout can be set up once per session type instead of being reconfigured
 * between sessions.
 *
 * Two rules govern the whole thing:
 *
 * - A trigger with no profile mapped means "leave the profile alone". That is
 *   the default for every trigger, so an untouched install never switches.
 * - Spotting outranks the session type while it lasts. It is a state rather
 *   than a session type, so it can occur inside any of them.
 *
 * A manual profile change is never fought: past the initial seed the switcher
 * only acts on a transition, so whatever the user picks stands until the
 * session type or the driving state actually changes.
 *
 * The seed is the exception, and it is what makes starting the app mid-session
 * behave like being there for the transition. It happens once, at construction,
 * before the user has had any chance to choose a profile for this run.
 */
export const createSessionProfileSwitcher = (
  deps: SessionProfileSwitcherDeps
): SessionProfileSwitcher => {
  const dwellMs = deps.dwellMs ?? SPOTTING_DWELL_MS;

  let sessionKey: ProfileTriggerKey | undefined;
  let spotting = false;
  let dwellTimer: ReturnType<typeof setTimeout> | undefined;

  const clearDwell = () => {
    if (dwellTimer === undefined) return;
    clearTimeout(dwellTimer);
    dwellTimer = undefined;
  };

  const apply = (reason: string) => {
    const map = deps.getMap();
    const trigger =
      spotting && map[SPOTTING_TRIGGER_KEY] ? SPOTTING_TRIGGER_KEY : sessionKey;
    if (!trigger) return;

    const profileId = map[trigger];
    if (!profileId) return;

    if (profileId === deps.getCurrentProfileId()) return;

    if (!deps.profileExists(profileId)) {
      // The profile was deleted after being mapped. Staying put is safer than
      // failing, and the mapping is left alone so it starts working again if
      // the profile comes back.
      logger.warn(
        `[sessionProfile] ${trigger} maps to profile ${profileId}, which no longer exists`
      );
      return;
    }

    logger.info(
      `[sessionProfile] ${reason}: switching to profile ${profileId} for ${trigger}`
    );
    try {
      deps.switchProfile(profileId);
    } catch (err) {
      logger.error('[sessionProfile] Failed to switch profile:', err);
    }
  };

  /** Returns whether the new state is worth acting on. */
  const takeSessionType = (sessionType: string): boolean => {
    const key = sessionProfileKeyFor(sessionType);
    if (!key) {
      // An unrecognised session type gets no opinion rather than a guess, so
      // the user keeps whatever layout they are on.
      logger.info(
        `[sessionProfile] No mapping vocabulary for session type "${sessionType}"`
      );
      sessionKey = undefined;
      return false;
    }
    sessionKey = key;
    return true;
  };

  /** Returns whether the new state is worth acting on. */
  const takeDrivingState = (
    isDriving: boolean,
    immediate: boolean
  ): boolean => {
    clearDwell();
    if (isDriving) {
      if (!spotting) return false;
      spotting = false;
      return true;
    }
    if (immediate) {
      // Seeding, not a transition. The dwell rides out the brief hops out of
      // the car during a session; someone already out when this attached has
      // been out for longer than the app has been running, and making them
      // wait would only delay the layout they configured for exactly this.
      spotting = true;
      return true;
    }
    dwellTimer = setTimeout(() => {
      dwellTimer = undefined;
      spotting = true;
      apply('out of the car');
    }, dwellMs);
    return false;
  };

  const unsubscribeType = deps.lifecycle.onSessionTypeChange((sessionType) => {
    if (takeSessionType(sessionType)) apply(`session type ${sessionType}`);
  });

  const unsubscribeDriving = deps.lifecycle.onDrivingStateChange(
    (isDriving) => {
      if (takeDrivingState(isDriving, false)) apply('back in the car');
    }
  );

  const unsubscribeDisconnect = deps.lifecycle.onDisconnect(() => {
    clearDwell();
    sessionKey = undefined;
    spotting = false;
  });

  // Seeded after subscribing, because the lifecycle reports transitions and
  // never replays them. The SDK starts publishing at iRacingSDKSetup and
  // startup awaits other work before constructing this, so launching irDashies
  // while already sat in a session means the session type resolved before there
  // was anything here to hear it. Without this the mapped profile stays
  // unapplied until some later transition — and in an event whose sessions all
  // report the same type, there may never be one.
  const initial = deps.lifecycle.getCurrentState();
  let seeded = false;
  if (initial.sessionType !== undefined) {
    seeded = takeSessionType(initial.sessionType) || seeded;
  }
  if (initial.isDriving !== undefined) {
    seeded = takeDrivingState(initial.isDriving, true) || seeded;
  }
  if (seeded) apply('current session state');

  return {
    dispose: () => {
      clearDwell();
      unsubscribeType();
      unsubscribeDriving();
      unsubscribeDisconnect();
    },
  };
};
