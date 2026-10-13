import { useMemo } from 'react';
import { useSessionStore } from '@irdashies/context';
import { loadLmuTrackData, loadTrackData } from '@irdashies/utils/trackData';
import type { LovelyTrackInfo, LovelyTrackSection } from '@irdashies/types';
import { lmuTrackDataId } from '@irdashies/types';
import { mapLovelyToTrackData } from '@irdashies/utils/lovelyTrackData';

interface LovelyTrackData {
  sections: LovelyTrackSection[];
  info: LovelyTrackInfo | null;
}

const EMPTY: LovelyTrackData = {
  sections: [],
  info: null,
};

/**
 * Track sections for the running session: corner names and where they are.
 *
 * Three sources, tried in order of how directly each answers for the track:
 *
 * 1. The LMU dataset, keyed by LMU's own names lowercased, so the name the sim
 *    publishes is the key.
 * 2. LMU_TRACK_DATA_IDS into the iRacing dataset, for the layouts LMU runs
 *    that the LMU dataset has not covered yet -- Laguna Seca, Silverstone's
 *    WEC layout, Road Atlanta.
 * 3. The iRacing dataset by name, which is already an id for an iRacing
 *    session.
 *
 * A name that reaches none of them yields nothing, and the widgets stay blank.
 * That is deliberate: the near-miss matching in loadTrackData used to answer
 * an LMU display name with whatever shared a word, and "Michelin Raceway Road
 * Atlanta" came back as "daytona 2011 road".
 *
 * Used by the Corner Names overlay and by the Lap Trace's corner comparison,
 * which is why it lives here rather than beside either of them.
 */
export const useLovelyTrackData = (): LovelyTrackData => {
  const trackName = useSessionStore((s) => s.session?.WeekendInfo?.TrackName);

  return useMemo(() => {
    if (!trackName) return EMPTY;

    const alias = lmuTrackDataId(trackName);
    const raw =
      loadLmuTrackData(trackName) ??
      (alias ? loadTrackData(alias) : null) ??
      loadTrackData(trackName);
    if (!raw) return EMPTY;

    return mapLovelyToTrackData(raw);
  }, [trackName]);
};
