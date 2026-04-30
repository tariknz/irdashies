import { useDashboard } from '@irdashies/context';
import { InformationBarWidgetSettings } from '@irdashies/types';

export const useInformationBarSettings = () => {
  const { currentDashboard } = useDashboard();

  const infobarSettings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'infobar'
  )?.config;

  return infobarSettings as unknown as InformationBarWidgetSettings['config'];
};
