import type { TrackGeometry } from '@irdashies/domain/track';
import type { DiveHint } from './radarHints';
import type { RadarArcStyle, RadarHazardKind } from '@irdashies/types';

export interface RadarDrawCar {
  carIdx: number;
  /** Metres along the track from the focus car, positive ahead. */
  dist: number;
  /** Metres from our line, positive to the left. */
  lateral: number;
  /** Rate of change of `dist` in m/s. */
  relativeSpeed: number;
  /** Lane from the spotter, for the debug labels. */
  lane: number;
  offTrack: boolean;
  /** Body size in metres. */
  length: number;
  width: number;
  fill: string;
  textColor: string;
  label: string;
}

export type WarningLevel = 'none' | 'close' | 'alongside';

/**
 * How worried to be about a rival: alongside once the bodies overlap along
 * the track, close inside `cautionDistance` metres of bumper-to-bumper gap.
 */
export const warningLevel = (
  dist: number,
  carLength: number,
  playerLength: number,
  cautionDistance: number
): WarningLevel => {
  const gap = Math.abs(dist) - (carLength + playerLength) / 2;
  if (gap <= 0) return 'alongside';
  if (gap < cautionDistance) return 'close';
  return 'none';
};

export interface RadarStyle {
  /** Labels in metres and km/h; imperial otherwise. */
  metric: boolean;
  range: number;
  /** Our car's body size in metres; also used for the pace car. */
  carLength: number;
  carWidth: number;
  showWarnings: boolean;
  warningArcs: boolean;
  warningArcStyle: RadarArcStyle;
  /** Metres of bumper gap below which a rival counts as close. */
  cautionDistance: number;
  /** Bumper gap written next to a close rival. */
  showGapLabel: boolean;
  showCarNumbers: boolean;
  showTrackMap: boolean;
  trackWidth: number;
  /** 0-100 */
  mapOpacity: number;
  showRings: boolean;
  ringSpacing: number;
  playerColor: string;
  /** 0-100 */
  backgroundOpacity: number;
  /** Share of the radius, 0-100, over which the picture fades out at the rim. */
  edgeFade: number;
  showCrosshair: boolean;
  /** Run the dashes of the line ahead/behind past at our speed. */
  axisMotion: boolean;
  /** Metres of each moving dash; the gaps are twice as long. */
  axisDashLength: number;
  /** Speed of the moving dashes, % of our own. */
  axisSpeed: number;
  closeColor: string;
  alongsideColor: string;
  /** Pulses per second on cars alongside; 0 keeps them steady. */
  pulseHz: number;
  arcMinDeg: number;
  arcMaxDeg: number;
  /** Rim arc thickness, % of the radius. */
  arcThickness: number;
  showOverlap: boolean;
  /** Share of a car's length from which the overlap strip turns red. */
  overlapThreshold: number;
  overlapShowPercent: boolean;
  diveGhost: boolean;
  diveShowClosing: boolean;
  diveArcs: boolean;
  diveArcStyle: RadarArcStyle;
  diveArcMinDeg: number;
  diveArcMaxDeg: number;
  showHazards: boolean;
  /** Metres ahead a hazard is shown from. */
  hazardRange: number;
  /** Metres under which a hazard flashes. */
  hazardBlinkDistance: number;
  hazardCrash: boolean;
  hazardSlow: boolean;
  hazardOff: boolean;
  hazardShowLabel: boolean;
  hazardShowSpeed: boolean;
  hazardArcs: boolean;
  hazardArcStyle: RadarArcStyle;
  hazardArcMinDeg: number;
  hazardArcMaxDeg: number;
  /** Car numbers are left out on cars drawn smaller than this, in px. */
  minLabelPx: number;
  debugLabels: boolean;
  showFrameTime: boolean;
}

/** The car to line up behind while pacing. */
export interface RadarDrawFollow {
  /** Car index, or null for the pace car (which is not in `cars`). */
  carIdx: number | null;
  dist: number;
  label: string;
}

/** A car in trouble ahead, already filtered by the hazard settings. */
export interface RadarDrawHazard {
  carIdx: number;
  /** Metres along the track from the focus car, positive ahead. */
  dist: number;
  kind: RadarHazardKind;
  /** Its own speed in m/s. */
  speed: number;
}

export interface RadarScene {
  /** CSS pixels of the square the radar fills. */
  size: number;
  geometry: TrackGeometry | null;
  trackLength: number;
  playerPct: number;
  cars: readonly RadarDrawCar[];
  follow: RadarDrawFollow | null;
  style: RadarStyle;
  /** Seconds, for the pulse on cars alongside. */
  time: number;
  /** Metres we have driven, for the moving dashes. */
  travelled: number;
  /** Milliseconds the previous frame took, for the dev readout. */
  frameMs?: number;
  /** Cars coming up fast behind, by car index. */
  dives?: ReadonlyMap<number, DiveHint>;
  /** Metres between lane centres, to place a diving car's ghost. */
  laneWidth?: number;
  /** Cars in trouble ahead, nearest first. */
  hazards?: readonly RadarDrawHazard[];
  /** Names the pole side the player just flipped to, for a few seconds. */
  poleSideNotice?: 'left' | 'right' | null;
  /** Middle of the road from our car, in lanes, positive to the right. */
  roadLane?: number;
}
