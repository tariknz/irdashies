import { useMemo } from 'react';
import { useDashboard, useSessionStore } from '@irdashies/context';
import {
  getWidgetDefaultConfig,
  type RadarWidgetSettings,
} from '@irdashies/types';
import {
  activeProfile,
  profileView,
} from '@irdashies/domain/radar/radarProfile';

const defaults = getWidgetDefaultConfig('radar');

type RadarConfig = RadarWidgetSettings['config'];

/** A saved radar config with any missing field taken from the defaults. */
export const withRadarDefaults = (
  saved: Partial<RadarConfig> | undefined
): RadarConfig => ({
  ...defaults,
  ...saved,
  background: { ...defaults.background, ...saved?.background },
  tuning: { ...defaults.tuning, ...saved?.tuning },
  sessionVisibility: {
    ...defaults.sessionVisibility,
    ...saved?.sessionVisibility,
  },
});

/** The saved radar config, as the profile for this track sees it. */
export const useRadarSettings = (): RadarConfig => {
  const { currentDashboard } = useDashboard();
  const saved = currentDashboard?.widgets.find(
    (widget) => widget.id === 'radar'
  )?.config as Partial<RadarConfig> | undefined;
  const trackType = useSessionStore(
    (state) => state.session?.WeekendInfo?.TrackType
  );

  return useMemo(() => {
    const config = withRadarDefaults(saved);
    return profileView(config, activeProfile(config, trackType));
  }, [saved, trackType]);
};
