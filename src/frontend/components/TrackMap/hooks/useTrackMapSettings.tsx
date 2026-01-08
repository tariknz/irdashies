import { useDashboard } from '@irdashies/context';

interface TrackMapSettings {
  enabled: boolean;
  config: {
    mapStyle: 'shape' | 'flat';
    enableTurnNames: boolean;
    showCarNumbers: boolean;
    invertTrackColors: boolean;
    driverCircleSize: number;
    playerCircleSize: number;
    trackLineWidth: number;
    trackOutlineWidth: number;
    useHighlightColor: boolean;
  };
}

export const useTrackMapSettings = () => {
  const { currentDashboard } = useDashboard();

  const settings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'map'
  )?.config;
  return settings as TrackMapSettings['config'];
};
