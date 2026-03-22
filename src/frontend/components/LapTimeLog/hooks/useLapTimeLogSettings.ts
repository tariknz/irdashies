import { useDashboard } from '@irdashies/context';
import type { LapTimeLogWidgetSettings } from '@irdashies/types';

export const useLapTimeLogSettings = () => {
  const { currentDashboard } = useDashboard();

   const standingsSettings = currentDashboard?.widgets.find(
      (widget) => widget.id === 'laptimelog'
    )?.config;
  
    return standingsSettings as unknown as LapTimeLogWidgetSettings['config'];

};