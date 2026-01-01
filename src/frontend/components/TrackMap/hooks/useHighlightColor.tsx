import { useDashboard } from '@irdashies/context';

export const useHighlightColor = () => {
  const { currentDashboard } = useDashboard();
  return currentDashboard?.generalSettings?.highlightColor;
};

