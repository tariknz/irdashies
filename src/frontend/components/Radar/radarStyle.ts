import type { RadarConfig } from '@irdashies/types';
import { colorNumToHex } from '@irdashies/utils/colors';
import type { RadarStyle } from './radarDraw';
import type { CarSize } from '@irdashies/domain/radar/carSizes';
import { OVERLAP_MARKS } from './radarHints';

/** What the drawing needs from the saved settings; `player` is our size. */
export const radarStyleFrom = (
  settings: RadarConfig,
  player: CarSize
): RadarStyle => ({
  range: settings.range,
  carLength: player.length,
  carWidth: player.width,
  showWarnings: settings.showWarnings,
  warningArcs: settings.warningArcs,
  warningArcStyle: settings.warningArcStyle,
  cautionDistance: settings.cautionDistance,
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
  hazardShowSpeed: settings.hazardShowSpeed,
  hazardArcs: settings.hazardArcs,
  hazardArcStyle: settings.hazardArcStyle,
  hazardArcMinDeg: settings.hazardArcMinDeg,
  hazardArcMaxDeg: settings.hazardArcMaxDeg,
  minLabelPx: settings.tuning.minLabelPx,
  debugLabels: settings.tuning.debugLabels,
  showFrameTime: settings.tuning.showFrameTime,
});
