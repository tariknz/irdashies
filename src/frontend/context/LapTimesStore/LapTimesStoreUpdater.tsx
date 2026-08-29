import { useEffect, useRef } from 'react';
import logger from '@irdashies/utils/logger';
import { useLapTimesSnapshot } from '../ChannelStore';
import { useLapTimesStore } from './LapTimesStore';

/**
 * Mirrors the main-process lap-times channel into the presentation store.
 * Pass `enabled: true` when any lap-time-dependent feature (deltas, avg lap)
 * is active in the consuming widget. Multiple widgets can call this safely.
 */
export const useLapTimesStoreUpdater = (enabled: boolean) => {
  const snapshot = useLapTimesSnapshot(enabled);
  const applySnapshot = useLapTimesStore((state) => state.applySnapshot);
  // Widgets that wait on lap times look empty until the first car has a time.
  // Log both moments once so a slow startup can be attributed.
  const logged = useRef({ arrived: false, populated: false });

  useEffect(() => {
    if (!snapshot || !enabled) return;
    applySnapshot(snapshot);

    const marks = logged.current;
    if (!marks.arrived) {
      marks.arrived = true;
      logger.debug(
        `[LapTimesStore] first snapshot: sessionNum=${snapshot.sessionNum} version=${snapshot.version} cars=${snapshot.lapTimes.length}`
      );
    }
    if (!marks.populated) {
      // Counted in place: this runs on every snapshot until a car sets a lap,
      // which can be minutes of a pre-race grid.
      let withTimes = 0;
      for (const time of snapshot.lapTimes) {
        if (time > 0) withTimes++;
      }
      if (withTimes > 0) {
        marks.populated = true;
        logger.debug(
          `[LapTimesStore] first populated snapshot: ${withTimes} cars with a lap time (version=${snapshot.version})`
        );
      }
    }
  }, [applySnapshot, enabled, snapshot]);
};
