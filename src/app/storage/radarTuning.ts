import {
  DEFAULT_RADAR_TUNING,
  type DashboardLayout,
  type RadarProcessorTuning,
} from '@irdashies/types';
import { getCurrentProfileId, getDashboard } from './dashboards';
import { onDashboardUpdated } from './dashboardEvents';

/** Every processor tuning value is a non-negative number. */
const TUNING_KEYS = [
  'speedSmoothing',
  'laneRate',
  'overlapSearchM',
  'poleLearnAfterS',
  'poleFlipFrames',
  'gridMaxSpeedMs',
] as const satisfies readonly (keyof RadarProcessorTuning)[];

/**
 * The saved dashboard is untrusted (hand-edited, imported): a NaN, or a
 * smoothing outside 0..1, would poison every car's speed, so such values
 * fall back to the default.
 */
export const tuningOf = (
  dashboard: DashboardLayout | null | undefined
): RadarProcessorTuning => {
  const saved: unknown = dashboard?.widgets.find(
    (widget) => widget.id === 'radar'
  )?.config?.tuning;
  const tuning: RadarProcessorTuning = { ...DEFAULT_RADAR_TUNING };
  if (!saved || typeof saved !== 'object') return tuning;
  for (const key of TUNING_KEYS) {
    const value = (saved as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      tuning[key] = value;
    }
  }
  if (tuning.speedSmoothing <= 0 || tuning.speedSmoothing > 1) {
    tuning.speedSmoothing = DEFAULT_RADAR_TUNING.speedSmoothing;
  }
  return tuning;
};

let cached: RadarProcessorTuning | null = null;

/**
 * The radar's dev tuning from the current dashboard. Read every frame, so it
 * is cached and refreshed whenever a dashboard is saved or switched.
 */
export const getRadarTuning = (): RadarProcessorTuning => {
  if (!cached) {
    cached = tuningOf(getDashboard(getCurrentProfileId()));
    onDashboardUpdated((dashboard) => {
      cached = tuningOf(dashboard);
    });
  }
  return cached;
};
