import { useDashboard } from '@irdashies/context';
import type { PitlaneHelperWidgetSettings } from '../../Settings/types';

export const usePitlaneHelperSettings = () => {
  const { currentDashboard } = useDashboard();

  const widget = currentDashboard?.widgets?.find(
    (w) => w.id === 'pitlanehelper'
  ) as PitlaneHelperWidgetSettings | undefined;

  const config = widget?.config ?? {
    showMode: 'approaching' as const,
    approachDistance: 200,
    enablePitLimiterWarning: true,
    enableEarlyPitboxWarning: true,
    earlyPitboxThreshold: 75,
    showPitlaneTraffic: true,
    background: { opacity: 80 },
    progressBarOrientation: 'horizontal' as const,
    speedBarOrientation: 'horizontal' as const,
    showPastPitBox: false,
    showProgressBar: true,
    showSpeedBar: true,
    showPitExitInputs: false,
    pitExitInputs: {
      throttle: true,
      clutch: true,
    },
    showInputsPhase: 'afterPitbox' as const,
    sessionVisibility: {
      race: true,
      loneQualify: false,
      openQualify: false,
      practice: true,
      offlineTesting: true,
    },
  };

  // Migrate old configs to include new fields
  const migratedConfig = {
    ...config,
    progressBarOrientation:
      config.progressBarOrientation ?? ('horizontal' as const),
    speedBarOrientation:
      config.speedBarOrientation ?? ('horizontal' as const),
    showSpeedBar: config.showSpeedBar ?? true,
    showPastPitBox: config.showPastPitBox ?? false,
    showPitExitInputs: config.showPitExitInputs ?? false,
    pitExitInputs: config.pitExitInputs ?? { throttle: true, clutch: true },
    showInputsPhase: config.showInputsPhase ?? ('afterPitbox' as const),
  };

  return migratedConfig;
};
