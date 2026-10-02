import type { RadarConfig } from '@irdashies/types';
import { colorNumToHex } from '@irdashies/utils/colors';
import type { RadarStyle } from './radarDraw';
import type { CarSize } from '@irdashies/domain/radar/carSizes';

/** What the drawing needs from the saved settings; `player` is our size. */
export const radarStyleFrom = (
  settings: RadarConfig,
  player: CarSize
): RadarStyle => ({
  range: settings.range,
  carLength: player.length,
  carWidth: player.width,
  showWarnings: settings.showWarnings,
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
  minLabelPx: settings.tuning.minLabelPx,
  debugLabels: settings.tuning.debugLabels,
  showFrameTime: settings.tuning.showFrameTime,
});
