import { useDashboard } from '@irdashies/context';
import { StandingsWidgetSettings } from '../../Settings/types';

export const useStandingsSettings = () => {
  const { currentDashboard } = useDashboard();

  const standingsSettings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'standings',
  )?.config;
  
  return standingsSettings as StandingsWidgetSettings['config'];
}; 