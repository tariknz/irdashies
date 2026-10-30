// Demo data for Rejoin Indicator component

export interface RejoinIndicatorSettings {
  config: {
    careGap: number;
    stopGap: number;
    showAtSpeed: number;
    sessionVisibility: {
      race: boolean;
      loneQualify: boolean;
      openQualify: boolean;
      practice: boolean;
      offlineTesting: boolean;
    };
  };
  enabled: boolean;
}

export interface RejoinIndicatorDemoData {
  gap: string;
  status: 'Clear' | 'Caution' | 'Do Not Rejoin';
}

/**
 * Demo gap at `elapsedSec`, swinging through Clear → Caution → Do Not Rejoin
 * against the given thresholds (defaults match the widget's shipped config).
 */
export const getDemoRejoinData = (
  settingsOrCare:
    | RejoinIndicatorSettings
    | undefined
    | { careGap?: number; stopGap?: number },
  elapsedSec = 0
): RejoinIndicatorDemoData => {
  const fromWidget =
    settingsOrCare && 'config' in settingsOrCare
      ? settingsOrCare.config
      : settingsOrCare;
  const careGap = fromWidget?.careGap ?? 2;
  const stopGap = fromWidget?.stopGap ?? 1;
  // 0.2s … careGap+0.8s so every status band is visited.
  const maxGap = Math.max(careGap + 0.8, 2.5);
  const gap = 0.2 + ((Math.sin(elapsedSec * 0.45) + 1) / 2) * (maxGap - 0.2);

  const status: RejoinIndicatorDemoData['status'] =
    gap >= careGap ? 'Clear' : gap >= stopGap ? 'Caution' : 'Do Not Rejoin';

  return {
    gap: gap.toFixed(1),
    status,
  };
};
