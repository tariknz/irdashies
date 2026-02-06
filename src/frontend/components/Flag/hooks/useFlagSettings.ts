import { useDashboard } from '@irdashies/context';
import { FlagWidgetSettings } from '../../Settings/types';

export const useFlagSettings = () => {
  const { currentDashboard } = useDashboard();
  const saved = currentDashboard?.widgets.find((w) => w.id === 'flag') as
    | FlagWidgetSettings
    | undefined;

  return {
    enabled: saved?.enabled ?? true,
    showOnlyWhenOnTrack: saved?.config?.showOnlyWhenOnTrack ?? true,
    showLabel: saved?.config?.showLabel ?? true,
    showNoFlagState: saved?.config?.showNoFlagState ?? true,
    matrixMode:
      (saved?.config?.matrixMode as '8x8' | '16x16' | 'uniform') ?? '16x16',
    animate: saved?.config?.animate ?? true,
    blinkPeriod: saved?.config?.blinkPeriod ?? 0.5,
    enableGlow: saved?.config?.enableGlow ?? true,
    sessionVisibility: saved?.config?.sessionVisibility ?? {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  };
};
