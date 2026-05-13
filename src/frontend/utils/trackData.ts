/**
 * Track section data utilities
 *
 * Data sourced from lovely-track-data repository:
 * https://github.com/Lovely-Sim-Racing/lovely-track-data
 *
 * This project provides per-track corner names, sectors, and pit-lane markers
 * for various racing games.
 *
 * Track data sourced from lovely-track-data repository and bundled in
 * src/frontend/assets/data/tracks-bundle.json
 * Update with: npm run fetch-lovely-track-data
 */

import trackDataBundle from '../assets/data/tracks-bundle.json';
import logger from '@irdashies/utils/logger';

export interface LovelyTurn {
  name?: string;
  // start/end are optional — Daytona's road configs have marker-only turns
  // with no start/end, and we filter those out at the mapping layer.
  start?: number;
  end?: number;
  marker?: number;
}

export interface LovelyStraight {
  name?: string;
  start?: number;
  end?: number;
  marker?: number;
}

export interface LovelySector {
  name: string;
  marker: number;
}

export interface LovelyTrack {
  name: string;
  trackId: string;
  country?: string;
  year?: number;
  length?: number;
  pitentry?: number;
  pitexit?: number;
  turn?: LovelyTurn[];
  straight?: LovelyStraight[];
  sector?: LovelySector[];
  time?: unknown[];
}

interface TrackDataBundleType {
  version: string;
  timestamp: number;
  tracks: Record<string, LovelyTrack>;
}

/**
 * Map of track ID variations to normalized track ID for lookup.
 * Handles iRacing's WeekendInfo.TrackName ↔ Lovely's trackId drift
 * (e.g. iRacing "silverstone gp" vs Lovely "silverstone 2019 gp").
 */
let trackIdNormalizations: Record<string, string> | null = null;

/**
 * Initialize the track ID normalization map.
 * Maps various track ID formats to the canonical Lovely trackId.
 */
function initializeNormalizations(): void {
  if (trackIdNormalizations !== null) return;

  trackIdNormalizations = {};
  const bundle = trackDataBundle as unknown as TrackDataBundleType;

  for (const trackId of Object.keys(bundle.tracks)) {
    // Store original
    trackIdNormalizations[trackId] = trackId;

    // Store lowercase
    trackIdNormalizations[trackId.toLowerCase()] = trackId;

    // Store normalized (lowercase, no special chars)
    const normalized = trackId.toLowerCase().replace(/[^a-z0-9]/g, '');
    trackIdNormalizations[normalized] = trackId;
  }
}

/**
 * Normalize an iRacing TrackName to find the matching bundled Lovely track.
 *
 * iRacing exposes WeekendInfo.TrackName as a space-separated lowercase slug
 * (e.g. "brandshatch grandprix", "nurburgring nordschleife") — same shape as
 * Lovely's trackId for the vast majority of tracks. Token-overlap fallback
 * handles the rare drift cases.
 */
function normalizeTrackId(trackName: string): string | null {
  initializeNormalizations();
  if (!trackIdNormalizations) return null;

  const variations = [
    trackName,
    trackName.toLowerCase(),
    trackName.toLowerCase().replace(/[^a-z0-9]/g, ''),
  ];

  for (const variation of variations) {
    if (variation in trackIdNormalizations) {
      return trackIdNormalizations[variation];
    }
  }

  // Token-overlap fallback: e.g. iRacing "silverstone gp" → Lovely "silverstone 2019 gp"
  const target = trackName.trim().toLowerCase();
  const targetTokens = new Set(target.split(/\s+/).filter(Boolean));
  if (targetTokens.size === 0) return null;

  const bundle = trackDataBundle as unknown as TrackDataBundleType;
  let best: { id: string; score: number } | null = null;
  for (const id of Object.keys(bundle.tracks)) {
    const entryTokens = new Set(id.split(/\s+/).filter(Boolean));
    let overlap = 0;
    for (const t of targetTokens) if (entryTokens.has(t)) overlap += 1;
    if (overlap === 0) continue;
    const containsAll = overlap === targetTokens.size;
    const surplus = entryTokens.size - overlap;
    const score = (containsAll ? 1000 : 0) + overlap * 10 - surplus;
    if (!best || score > best.score) best = { id, score };
  }

  return best?.id ?? null;
}

/**
 * Loads Lovely track data for the current iRacing track.
 *
 * Loads instantly from the bundled JSON — no network, no async.
 *
 * @param trackName WeekendInfo.TrackName from the iRacing session
 * @returns The raw Lovely track data, or null if no match in the bundle
 */
export const loadTrackData = (trackName: string): LovelyTrack | null => {
  try {
    const bundle = trackDataBundle as unknown as TrackDataBundleType;
    const normalizedId = normalizeTrackId(trackName);

    if (normalizedId && normalizedId in bundle.tracks) {
      return bundle.tracks[normalizedId];
    }

    return null;
  } catch (error) {
    logger.warn('Failed to load track data:', error);
    return null;
  }
};

/**
 * Returns every bundled track (used for storybook fixtures, debug pickers).
 */
export const getAvailableTracks = (): {
  trackId: string;
  trackName: string;
}[] => {
  const bundle = trackDataBundle as unknown as TrackDataBundleType;
  return Object.values(bundle.tracks).map((t) => ({
    trackId: t.trackId,
    trackName: t.name,
  }));
};
