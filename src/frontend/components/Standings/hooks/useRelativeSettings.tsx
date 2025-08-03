import { useDashboard } from '@irdashies/context';
import { RelativeWidgetSettings } from '../../Settings/types';

export const useRelativeSettings = () => {
  const { currentDashboard } = useDashboard();

  const relativeSettings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'relative',
  )?.config;
  
  return relativeSettings as RelativeWidgetSettings['config'];
}; 