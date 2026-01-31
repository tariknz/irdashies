import { useDashboard } from '@irdashies/context';
import { FlagWidgetSettings } from '../../Settings/types';

export const useFlagSettings = () => {
  const { currentDashboard } = useDashboard();
  const saved = currentDashboard?.widgets.find((w) => w.id === 'flag') as FlagWidgetSettings | undefined;

  return {
    enabled: saved?.enabled ?? true,
    showOnlyWhenOnTrack: saved?.config?.showOnlyWhenOnTrack ?? false,
    showLabel: saved?.config?.showLabel ?? true,
    showNoFlagState: saved?.config?.showNoFlagState ?? true,
    matrixMode: (saved?.config?.matrixMode as '8x8' | '16x16' | 'uniform') ?? '16x16',
    animate: saved?.config?.animate ?? false,
    blinkPeriod: saved?.config?.blinkPeriod ?? 0.5,
    sessionVisibility: saved?.config?.sessionVisibility ?? {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true
    },
  };
};