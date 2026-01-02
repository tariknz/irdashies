import { useDashboard } from '@irdashies/context';
import { GarageCoverWidgetSettings } from '../../Settings/types';
import { useMemo } from 'react';

const defaultConfig: GarageCoverWidgetSettings['config'] = {
  imageFilename: '',
  showOnlyWhenOnTrack: true,
};

export const useGarageCoverSettings = () => {
    const { currentDashboard } = useDashboard();

    return useMemo(() => {
        const garageCoverSettings = currentDashboard?.widgets.find(
            (widget) => widget.id === 'garagecover',
        )?.config;

        return { ...defaultConfig, ...(garageCoverSettings as GarageCoverWidgetSettings['config']) };
    }, [currentDashboard]);
}; 