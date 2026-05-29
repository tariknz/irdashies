import { useMemo } from 'react';
import { useSessionStore } from '@irdashies/context';
import { loadTrackData } from '@irdashies/utils/trackData';
import type { LovelyTrackInfo, LovelyTrackSection } from '@irdashies/types';
import { mapLovelyToTrackData } from '../lovelyTrackData';

interface LovelyTrackData {
  sections: LovelyTrackSection[];
  info: LovelyTrackInfo | null;
}

const EMPTY: LovelyTrackData = {
  sections: [],
  info: null,
};

/**
 * Loads track section data for the current iRacing session from the bundled
 * Lovely Sim Racing dataset. Synchronous — the bundle is imported at module
 * load (see src/frontend/utils/trackData.ts), mirroring the cars-bundle
 * pattern used by the Tachometer widget.
 */
export const useLovelyTrackData = (): LovelyTrackData => {
  const trackName = useSessionStore((s) => s.session?.WeekendInfo?.TrackName);

  return useMemo(() => {
    if (!trackName) return EMPTY;
    const raw = loadTrackData(trackName);
    if (!raw) return EMPTY;
    return mapLovelyToTrackData(raw);
  }, [trackName]);
};
