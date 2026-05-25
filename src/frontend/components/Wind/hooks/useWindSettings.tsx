import { useMemo } from 'react';
import { useDashboard } from '@irdashies/context';
import type { WindWidgetSettings } from '@irdashies/types';

export const useWindSettings = () => {
  const { currentDashboard } = useDashboard();

  return useMemo(
    () =>
      currentDashboard?.widgets.find((w) => w.id === 'wind')
        ?.config as unknown as WindWidgetSettings['config'],
    [currentDashboard]
  );
};
