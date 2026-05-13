/**
 * Types for the Corner Name overlay, sourced from Lovely Sim Racing track data
 * (https://github.com/Lovely-Sim-Racing/lovely-track-data).
 */

import type { SessionVisibilitySettings } from './widgetConfigs';

export interface CornerNameOverlayConfig {
  showCornerNumber: boolean;
  showProgressBar: boolean;
  showTrackPct: boolean;
  fontSize: number;
  opacity: number;
  sessionVisibility: SessionVisibilitySettings;
}

export type SectionType =
  | 'corner'
  | 'chicane'
  | 'hairpin'
  | 'sweeper'
  | 'kink'
  | 'complex'
  | 'straight';

/**
 * A single named track segment (corner or named straight) on the lap.
 *
 * `length_pct` and `corner_number` are derived; everything else is mapped
 * directly from the upstream Lovely JSON.
 */
export interface LovelyTrackSection {
  section_id: string; // slugified name, stable per track
  name: string; // raw name (e.g. "Eau Rouge")
  type: SectionType; // inferred from name regex
  start_pct: number; // 0-1 lap distance
  end_pct: number; // 0-1 lap distance
  length_pct: number; // end_pct - start_pct, wrap-aware
  marker_pct?: number; // optional apex marker (some tracks have this per turn)
  corner_number?: string; // "T1" if name matches /^Turn N$/
}

/** A pit-lane / sector / straight marker on the lap. */
export interface TrackMarker {
  name: string;
  marker_pct: number;
}

/**
 * Track-level metadata mapped from the Lovely JSON. All optional except name +
 * track_id; tracks vary in which fields they include.
 */
export interface LovelyTrackInfo {
  track_id: string; // Lovely's trackId (space-separated, lowercased)
  name: string; // human-readable name
  country?: string; // ISO country code (e.g. "BE")
  year?: number;
  length_m?: number;
  pit_entry_pct?: number;
  pit_exit_pct?: number;
  sectors: TrackMarker[]; // iRacing sector boundaries
  straights: LovelyTrackSection[]; // named straights, if present
  reference_times?: unknown[]; // raw, schema unknown — passthrough for now
}
