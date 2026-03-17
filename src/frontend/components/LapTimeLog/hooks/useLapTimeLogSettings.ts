import { useDashboard } from '@irdashies/context';
import type { LapTimeLogWidgetSettings } from '@irdashies/types';

const DEFAULT_CONFIG: LapTimeLogWidgetSettings = {
  enabled: false,
  config: {
    scale: 100,
    alignment: 'top',
    reverse: false,
    showCurrentLap: true,
    showPredictedLap: true,
    showLastLap: true,
    showBestLap: true,
    delta: {
      enabled: true,
      method: 'bestlap',
    },
    history: {
      enabled: true,
      count: 10,
    },
    background: {
      opacity: 80,
    },
    foreground: { 
      opacity: 70 
    },
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
};

export const useLapTimeLogSettings = () => {
  const { currentDashboard } = useDashboard();

  const saved = currentDashboard?.widgets.find((w) => w.id === 'laptimelog') as
    | LapTimeLogWidgetSettings
    | undefined;

  if (saved && typeof saved === 'object') {
    return {
      ...DEFAULT_CONFIG,
      enabled: saved.enabled ?? DEFAULT_CONFIG.enabled,
      config: {
        ...DEFAULT_CONFIG.config,
        background: {
          opacity:
            saved.config.background?.opacity ??
            DEFAULT_CONFIG.config.background.opacity,
        },
        foreground: {
          opacity:
            saved.config.foreground?.opacity ??
            DEFAULT_CONFIG.config.foreground.opacity,
        },
        scale: saved.config?.scale ?? DEFAULT_CONFIG.config.scale,
        alignment: saved.config?.alignment ?? DEFAULT_CONFIG.config.alignment,
        reverse: saved.config?.reverse ?? DEFAULT_CONFIG.config.reverse,
        showCurrentLap: saved.config?.showCurrentLap ?? DEFAULT_CONFIG.config.showCurrentLap,
        showPredictedLap: saved.config?.showPredictedLap ?? DEFAULT_CONFIG.config.showPredictedLap,
        showLastLap: saved.config?.showLastLap ?? DEFAULT_CONFIG.config.showLastLap,
        showBestLap: saved.config?.showBestLap ?? DEFAULT_CONFIG.config.showBestLap,
        delta: saved.config?.delta ?? DEFAULT_CONFIG.config.delta,   
        history: saved.config?.history ?? DEFAULT_CONFIG.config.history,   
        sessionVisibility: saved.config?.sessionVisibility ?? DEFAULT_CONFIG.config.sessionVisibility,
      },
    } as LapTimeLogWidgetSettings;
  }

  return DEFAULT_CONFIG;
};