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

/** Gap sweeps Clear → Caution → Do Not Rejoin over ~12s (default thresholds). */
export const getDemoRejoinData = (elapsedSec = 0): RejoinIndicatorDemoData => {
  const careGap = 2;
  const stopGap = 1;
  const phase = (elapsedSec % 12) / 12;
  const gap = 0.2 + Math.abs(1 - 2 * phase) * 2.8;

  const status =
    gap >= careGap ? 'Clear' : gap >= stopGap ? 'Caution' : 'Do Not Rejoin';

  return {
    gap: gap.toFixed(1),
    status,
  };
};
