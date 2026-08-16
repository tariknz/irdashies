import { useEffect } from 'react';
import logger from '@irdashies/utils/logger';
import { currentHydrationEpoch, useRaceControlStore } from './RaceControlStore';

export const useRaceControlBridge = () => {
  const hydrateIncidents = useRaceControlStore((s) => s.hydrateIncidents);
  const addIncident = useRaceControlStore((s) => s.addIncident);
  const clearIncidents = useRaceControlStore((s) => s.clearIncidents);
  const resetForSession = useRaceControlStore((s) => s.resetForSession);

  useEffect(() => {
    if (!window.channelBridge) return;
    return window.channelBridge.subscribe('raceControl.incidents', addIncident);
  }, [addIncident]);

  useEffect(() => {
    const bridge = window.raceControlBridge;
    if (!bridge) return;

    let cancelled = false;
    let loadGeneration = 0;
    let lastSessionId: string | undefined;

    const load = () => {
      const generation = ++loadGeneration;
      // Snapshot the epoch first: if the list is cleared while this request is
      // in flight, the response is stale and gets dropped instead of
      // resurrecting incidents the user just dismissed.
      const epoch = currentHydrationEpoch();
      bridge
        .getIncidents()
        .then((snapshot) => {
          if (cancelled || generation !== loadGeneration) return;
          // A manual clear while this request was in flight wins over disk.
          if (currentHydrationEpoch() !== epoch) return;
          // An empty ID means disconnected. Preserve the completed session so
          // it remains available for post-race review.
          if (!snapshot.sessionId) return;
          if (
            lastSessionId !== undefined &&
            snapshot.sessionId !== lastSessionId
          ) {
            resetForSession();
          }
          lastSessionId = snapshot.sessionId;
          hydrateIncidents(snapshot.incidents, currentHydrationEpoch());
        })
        .catch((err) =>
          logger.error('[RaceControl] Failed to load incidents', err)
        );
    };

    // Reads whatever session main is on right now, which covers a Gantry
    // opened mid-session. The subscription below only catches later changes.
    load();

    const unsubscribe = window.channelBridge?.subscribe(
      'raceControl.sessionId',
      (sessionId) => {
        // '' means disconnected, not a new session. Leave the list alone so a
        // disconnect doesn't wipe the incidents the user is still reviewing.
        if (!sessionId || sessionId === lastSessionId) return;
        lastSessionId = sessionId;
        // Each session has its own incident file, so the previous session's
        // list must go. This also applies to the first event: the mount-time
        // load may already have hydrated the SubSessionID active when Gantry
        // opened. Incidents detected between here and the response are merged
        // in by `hydrateIncidents` rather than lost.
        resetForSession();
        load();
      }
    );
    const reloadWhenVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', reloadWhenVisible);

    return () => {
      cancelled = true;
      unsubscribe?.();
      document.removeEventListener('visibilitychange', reloadWhenVisible);
    };
  }, [hydrateIncidents, clearIncidents, resetForSession]);
};
