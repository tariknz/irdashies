import {
  DEFAULT_RADAR_TUNING,
  type DashboardLayout,
  type RadarProcessorTuning,
} from '@irdashies/types';
import { getCurrentProfileId, getDashboard } from './dashboards';
import { onDashboardUpdated } from './dashboardEvents';

const tuningOf = (
  dashboard: DashboardLayout | null | undefined
): RadarProcessorTuning => {
  const saved = dashboard?.widgets.find((widget) => widget.id === 'radar')
    ?.config?.tuning as Partial<RadarProcessorTuning> | undefined;
  return { ...DEFAULT_RADAR_TUNING, ...saved };
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
