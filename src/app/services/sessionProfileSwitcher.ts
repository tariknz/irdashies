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
 * A manual profile change is never fought: the switcher only acts on a
 * transition, so whatever the user picks stands until the session type or the
 * driving state actually changes.
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

  const unsubscribeType = deps.lifecycle.onSessionTypeChange((sessionType) => {
    const key = sessionProfileKeyFor(sessionType);
    if (!key) {
      // An unrecognised session type gets no opinion rather than a guess, so
      // the user keeps whatever layout they are on.
      logger.info(
        `[sessionProfile] No mapping vocabulary for session type "${sessionType}"`
      );
      sessionKey = undefined;
      return;
    }
    sessionKey = key;
    apply(`session type ${sessionType}`);
  });

  const unsubscribeDriving = deps.lifecycle.onDrivingStateChange(
    (isDriving) => {
      clearDwell();
      if (isDriving) {
        if (!spotting) return;
        spotting = false;
        apply('back in the car');
        return;
      }
      dwellTimer = setTimeout(() => {
        dwellTimer = undefined;
        spotting = true;
        apply('out of the car');
      }, dwellMs);
    }
  );

  const unsubscribeDisconnect = deps.lifecycle.onDisconnect(() => {
    clearDwell();
    sessionKey = undefined;
    spotting = false;
  });

  return {
    dispose: () => {
      clearDwell();
      unsubscribeType();
      unsubscribeDriving();
      unsubscribeDisconnect();
    },
  };
};
