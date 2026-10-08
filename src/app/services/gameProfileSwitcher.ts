import type {
  ActiveSimulator,
  GameDetectionStatus,
  GameProfileAssignments,
  GameProfileDefaults,
} from '@irdashies/types';
import logger from '../logger';
import { ensureGameProfiles } from '../storage/dashboards';
import {
  gameProfileIdsFor,
  resolveActiveGameProfile,
  type SimProcessSnapshot,
} from '../gameProfiles/resolveGameProfile';

const POLL_MS = 2000;

export interface GameProfileSwitcherDeps {
  getEnabled: () => boolean;
  getCurrentProfileId: () => string;
  getGameProfileDefaults: () => GameProfileDefaults;
  getGameProfileAssignments: () => GameProfileAssignments;
  profileExists: (profileId: string) => boolean;
  switchProfile: (profileId: string) => void;
  listProcesses: () => Promise<SimProcessSnapshot[]>;
  publishStatus?: (status: GameDetectionStatus) => void;
  pollMs?: number;
}

export interface GameProfileSwitcher {
  dispose: () => void;
  isHolding: () => boolean;
}

let holding = false;
let status: GameDetectionStatus = { game: null, running: false };
let kick: (() => void) | undefined;

export const getGameDetectionStatus = (): GameDetectionStatus => status;

export const isGameProfileHolding = (): boolean => holding;

/** Re-read the autodetect setting and apply the current process list. */
export const kickGameProfileSwitcher = (): void => {
  kick?.();
};

const processKey = (processes: readonly SimProcessSnapshot[]): string =>
  [...processes]
    .sort((a, b) => a.id.localeCompare(b.id) || a.startedAt - b.startedAt)
    .map((process) => `${process.id}:${process.startedAt}`)
    .join('|');

/**
 * Polls sim processes and switches the active dashboard profile to match.
 *
 * A manual profile change stands until the process set changes, the same way
 * the session switcher only acts on a transition. Nothing running leaves the
 * current profile where it is.
 */
export const createGameProfileSwitcher = (
  deps: GameProfileSwitcherDeps
): GameProfileSwitcher => {
  ensureGameProfiles();

  const pollMs = deps.pollMs ?? POLL_MS;
  let lastKey: string | null = null;
  let force = false;
  let stopped = false;
  let inFlight = false;
  let again = false;

  const publish = (running: boolean, game: ActiveSimulator | null) => {
    const next: GameDetectionStatus = {
      game: game ?? status.game,
      running,
    };
    if (next.game === status.game && next.running === status.running) return;
    status = next;
    deps.publishStatus?.(status);
  };

  const apply = (processes: SimProcessSnapshot[]) => {
    const key = processKey(processes);
    const changed = force || key !== lastKey;
    force = false;
    lastKey = key;
    if (!changed) return;

    const decision = resolveActiveGameProfile({
      processes,
      previousProfileId: deps.getCurrentProfileId(),
      profileIds: gameProfileIdsFor(
        deps.getGameProfileDefaults(),
        deps.profileExists,
        deps.getGameProfileAssignments()
      ),
    });

    if (!decision.activeGame) {
      holding = false;
      publish(false, null);
      return;
    }

    holding = true;
    publish(true, decision.activeGame);
    if (decision.profileId === deps.getCurrentProfileId()) return;

    if (!deps.profileExists(decision.profileId)) {
      ensureGameProfiles();
    }
    if (!deps.profileExists(decision.profileId)) {
      logger.warn(
        `[gameProfile] ${decision.activeGame} maps to profile ${decision.profileId}, which does not exist`
      );
      return;
    }

    logger.info(
      `[gameProfile] switching to profile ${decision.profileId} for ${decision.activeGame}`
    );
    try {
      deps.switchProfile(decision.profileId);
    } catch (err) {
      logger.error('[gameProfile] Failed to switch profile:', err);
    }
  };

  const run = async () => {
    if (stopped) return;

    let processes: SimProcessSnapshot[];
    try {
      processes = await deps.listProcesses();
    } catch (err) {
      logger.error('[gameProfile] Failed to list sim processes:', err);
      return;
    }
    if (stopped) return;

    if (!deps.getEnabled()) {
      holding = false;
      lastKey = null;
      const decision = resolveActiveGameProfile({
        processes,
        previousProfileId: deps.getCurrentProfileId(),
        profileIds: gameProfileIdsFor(
          deps.getGameProfileDefaults(),
          deps.profileExists,
          deps.getGameProfileAssignments()
        ),
      });
      publish(decision.activeGame !== null, decision.activeGame);
      return;
    }

    apply(processes);
  };

  const tick = () => {
    if (inFlight) {
      again = true;
      return;
    }
    inFlight = true;
    void run().finally(() => {
      inFlight = false;
      if (again && !stopped) {
        again = false;
        tick();
      }
    });
  };

  kick = () => {
    force = true;
    tick();
  };

  tick();
  const timer = setInterval(tick, pollMs);

  return {
    isHolding: () => holding,
    dispose: () => {
      stopped = true;
      holding = false;
      if (kick) kick = undefined;
      clearInterval(timer);
    },
  };
};
