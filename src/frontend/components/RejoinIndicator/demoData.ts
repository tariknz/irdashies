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

// Demo data for rejoin indicator
export const getDemoRejoinData = (settings: RejoinIndicatorSettings | undefined): RejoinIndicatorDemoData => {
  // Demo: car behind at 1.5 seconds - should show "Caution" status
  const gap = 1.5;
  const cfg = settings?.config || { careGap: 2, stopGap: 1 };

  const status = gap >= cfg.careGap
    ? 'Clear'
    : gap >= cfg.stopGap
      ? 'Caution'
      : 'Do Not Rejoin';

  return {
    gap: gap.toFixed(1),
    status,
  };
};
