import type { SectorColor } from '@irdashies/context';
import type { SectorDeltaConfig } from '@irdashies/types';

const DEFAULT_GREEN_THRESHOLD_PERCENT = 0.5;
const DEFAULT_YELLOW_THRESHOLD_PERCENT = 1.0;

export function getSectorDeltaThresholdPercentages(
  thresholds?: SectorDeltaConfig['thresholds']
): { green: number; yellow: number } {
  return {
    green: thresholds?.green ?? DEFAULT_GREEN_THRESHOLD_PERCENT,
    yellow: thresholds?.yellow ?? DEFAULT_YELLOW_THRESHOLD_PERCENT,
  };
}

export function getSectorDeltaThresholdFractions(
  thresholds?: SectorDeltaConfig['thresholds']
): { green: number; yellow: number } {
  const { green, yellow } = getSectorDeltaThresholdPercentages(thresholds);
  return {
    green: green / 100,
    yellow: yellow / 100,
  };
}

export function computeGhostSectorColor(
  lapTime: number | null,
  refTime: number | null,
  thresholds?: SectorDeltaConfig['thresholds']
): SectorColor {
  if (lapTime === null || refTime === null || refTime <= 0) return 'default';

  const delta = lapTime - refTime;
  if (delta <= 0) return 'purple';

  const { green, yellow } = getSectorDeltaThresholdFractions(thresholds);
  const ratio = delta / refTime;

  if (ratio <= green) return 'green';
  if (ratio <= yellow) return 'yellow';
  return 'red';
}
