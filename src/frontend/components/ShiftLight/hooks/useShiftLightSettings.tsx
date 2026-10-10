import { useDashboard } from '@irdashies/context';
import type {
  ShiftLightWidgetSettings,
  DashboardWidget,
} from '@irdashies/types';

const SETTING_ID = 'shiftlight';

export const useShiftLightSettings = () => {
  const { currentDashboard } = useDashboard();
  const widget = currentDashboard?.widgets?.find(
    (w: DashboardWidget) => w.id === SETTING_ID
  );
  return widget?.config as ShiftLightWidgetSettings['config'] | undefined;
};
