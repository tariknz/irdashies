import type { RadarConfig } from '@irdashies/types';
import { colorNumToHex } from '@irdashies/utils/colors';
import type { RadarStyle } from './radarDraw';
import type { CarSize } from '@irdashies/domain/radar/carSizes';
import { OVERLAP_MARKS } from './radarHints';

const FEET_PER_METRE = 3.28084;
const MPH_PER_MS = 2.23694;

/** Speed in km/h or mph, rounded, without the unit. */
export const speedIn = (metresPerSecond: number, metric: boolean): number =>
  Math.round(metresPerSecond * (metric ? 3.6 : MPH_PER_MS));

export const speedUnit = (metric: boolean) => (metric ? 'km/h' : 'mph');

/** A distance for the disc: tenths under 10, whole numbers above. */
export const formatDistance = (metres: number, metric: boolean): string => {
  const value = metric ? metres : metres * FEET_PER_METRE;
  const text = value < 10 ? value.toFixed(1) : String(Math.round(value));
  return `${text}${metric ? 'm' : 'ft'}`;
};

/** What the drawing needs from the saved settings; `player` is our size. */
export const radarStyleFrom = (
  settings: RadarConfig,
  player: CarSize,
  metric = true
): RadarStyle => ({
  metric,
  range: settings.range,
  carLength: player.length,
  carWidth: player.width,
  showWarnings: settings.showWarnings,
  warningArcs: settings.warningArcs,
  warningArcStyle: settings.warningArcStyle,
  cautionDistance: settings.cautionDistance,
  showGapLabel: settings.showGapLabel,
  showCarNumbers: settings.showCarNumbers,
  showTrackMap: settings.showTrackMap,
  trackWidth: settings.trackWidth,
  mapOpacity: settings.mapOpacity,
  showRings: settings.showRings,
  ringSpacing: settings.ringSpacing,
  playerColor: colorNumToHex(settings.playerColor) ?? '#ffffff',
  backgroundOpacity: settings.background.opacity,
  edgeFade: settings.edgeFade,
  showCrosshair: settings.showCrosshair,
  axisMotion: settings.axisMotion,
  axisDashLength: settings.axisDashLength,
  axisSpeed: settings.axisSpeed,
  closeColor: colorNumToHex(settings.closeColor) ?? '#f59e0b',
  alongsideColor: colorNumToHex(settings.alongsideColor) ?? '#ef4444',
  pulseHz: settings.pulseHz,
  arcMinDeg: settings.arcMinDeg,
  arcMaxDeg: settings.arcMaxDeg,
  arcThickness: settings.arcThickness,
  showOverlap: settings.showOverlap,
  overlapThreshold:
    OVERLAP_MARKS[settings.overlapThreshold] ?? OVERLAP_MARKS.door,
  overlapShowPercent: settings.overlapShowPercent,
  diveGhost: settings.diveGhost,
  diveShowClosing: settings.diveShowClosing,
  diveArcs: settings.diveArcs,
  diveArcStyle: settings.diveArcStyle,
  diveArcMinDeg: settings.diveArcMinDeg,
  diveArcMaxDeg: settings.diveArcMaxDeg,
  showHazards: settings.showHazards,
  hazardRange: settings.hazardRange,
  hazardBlinkDistance: settings.hazardBlinkDistance,
  hazardCrash: settings.hazardCrash,
  hazardSlow: settings.hazardSlow,
  hazardOff: settings.hazardOff,
  hazardShowLabel: settings.hazardShowLabel,
  hazardShowSpeed: settings.hazardShowSpeed,
  hazardArcs: settings.hazardArcs,
  hazardArcStyle: settings.hazardArcStyle,
  hazardArcMinDeg: settings.hazardArcMinDeg,
  hazardArcMaxDeg: settings.hazardArcMaxDeg,
  minLabelPx: settings.tuning.minLabelPx,
  debugLabels: settings.tuning.debugLabels,
  showFrameTime: settings.tuning.showFrameTime,
});
