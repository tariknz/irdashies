import { useDashboard } from '@irdashies/context';
import { StandingsWidgetSettings } from '../sections/StandingsSettings';

export const useStandingsSettings = () => {
  const { currentDashboard } = useDashboard();
  const settings = currentDashboard?.widgets.find((w) => w.id === 'standings')?.config as StandingsWidgetSettings['config'];

  return {
    showIRatingChange: settings?.showIRatingChange ?? true,
  };
}; 