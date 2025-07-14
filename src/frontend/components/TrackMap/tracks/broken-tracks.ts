import { TrackDrawing } from '../TrackCanvas';

export interface BrokenTrack {
  id: number;
  name: string;
  issue: string;
}

export const BROKEN_TRACKS: BrokenTrack[] = [
  // Suzuka variants - non-continuous
  { id: 168, name: 'Suzuka', issue: 'non-continuous' },
  { id: 173, name: 'Suzuka', issue: 'non-continuous' },
  { id: 175, name: 'Suzuka', issue: 'non-continuous' },
  { id: 176, name: 'Suzuka', issue: 'non-continuous' },
  
  // Oran Park variants - non-continuous
  { id: 202, name: 'Oran Park', issue: 'non-continuous' },
  { id: 207, name: 'Oran Park', issue: 'non-continuous' },
  { id: 209, name: 'Oran Park', issue: 'non-continuous' },
  { id: 211, name: 'Oran Park', issue: 'non-continuous' },
  
  // Daytona Bike - no position
  { id: 193, name: 'Daytona Bike', issue: 'no position' },
  
  // Irwindale Figure 8 - non-continuous
  { id: 217, name: 'Irwindale Figure 8', issue: 'non-continuous' },
  { id: 388, name: 'Irwindale Figure 8', issue: 'non-continuous' },
  
  // Monza variants - non-continuous
  { id: 239, name: 'Monza', issue: 'non-continuous' },
  { id: 240, name: 'Monza', issue: 'non-continuous' },
  { id: 242, name: 'Monza', issue: 'non-continuous' },
  { id: 246, name: 'Monza', issue: 'non-continuous' },
  { id: 247, name: 'Monza', issue: 'non-continuous' },
  
  // Nashville Superspeedway - no position
  { id: 400, name: 'Nashville Superspeedway', issue: 'no position' },
  
  // LA Coliseum - two paths
  { id: 437, name: 'LA Coliseum', issue: 'two paths' },
  
  // Wheatland Lucasoil - two paths
  { id: 452, name: 'Wheatland Lucasoil', issue: 'two paths' },
  
  // Slinger - figure 8
  { id: 506, name: 'Slinger', issue: 'figure 8' },
];

export const BROKEN_TRACK_IDS = BROKEN_TRACKS.map(track => track.id);

/**
 * Check if a track ID is broken
 */
export const isBrokenTrack = (trackId: number): boolean => {
  return BROKEN_TRACK_IDS.includes(trackId);
};

/**
 * Get broken track info by ID
 */
export const getBrokenTrackInfo = (trackId: number): BrokenTrack | undefined => {
  return BROKEN_TRACKS.find(track => track.id === trackId);
};

/**
 * Filter out broken tracks based on environment
 * In production, broken tracks are hidden
 * In development/storybook, all tracks are available
 */
export const shouldShowTrack = (trackId: number, trackDrawing: TrackDrawing): boolean => {
  // In development or storybook, show all tracks (including broken ones)
  if (import.meta.env?.DEV || import.meta.env?.MODE === 'storybook') {
    return true;
  }

  if (!trackDrawing?.startFinish?.point) return false;
  if (!trackDrawing?.active?.inside) return false;

  return !isBrokenTrack(trackId);
};
