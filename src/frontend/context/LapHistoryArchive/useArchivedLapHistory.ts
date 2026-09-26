import { useEffect, useState } from 'react';
import type { LapHistorySnapshot } from '@irdashies/types';
import logger from '@irdashies/utils/logger';

interface Loaded {
  key: string;
  snapshot: LapHistorySnapshot | null;
}

/**
 * Lap history this PC archived for one session of the current event. Pass
 * null to load nothing. `eventId` (the SubSessionID) refetches when the event
 * changes. Returns null until the requested session has loaded.
 */
export const useArchivedLapHistory = (
  sessionNum: number | null,
  eventId = ''
): LapHistorySnapshot | null => {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = sessionNum === null ? '' : `${eventId}:${sessionNum}`;

  useEffect(() => {
    const bridge = window.lapHistoryBridge;
    if (sessionNum === null || !bridge) return;
    let cancelled = false;
    bridge
      .getArchived(sessionNum)
      .then((snapshot) => {
        if (!cancelled) setLoaded({ key, snapshot });
      })
      .catch((err) =>
        logger.warn('[LapHistory] Failed to load archived lap history', err)
      );
    return () => {
      cancelled = true;
    };
  }, [key, sessionNum]);

  return key && loaded?.key === key ? loaded.snapshot : null;
};
