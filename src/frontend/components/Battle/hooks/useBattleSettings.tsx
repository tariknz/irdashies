import { useDashboard } from '@irdashies/context';
import { BattleWidgetSettings } from '@irdashies/types';

export const useBattleSettings = ():
  | BattleWidgetSettings['config']
  | undefined => {
  const { currentDashboard } = useDashboard();
  const widget = currentDashboard?.widgets.find((w) => w.id === 'battle');
  return widget?.config as unknown as BattleWidgetSettings['config'];
};
