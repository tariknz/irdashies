import { useDashboard } from '@irdashies/context';

interface TrackMapSettings {
  enabled: boolean;
  config: {
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

  // Add type guard to ensure settings matches expected shape
  if (
    settings &&
    typeof settings === 'object' &&
    'enableTurnNames' in settings &&
    typeof settings.enableTurnNames === 'boolean' &&
    ('showCarNumbers' in settings ? typeof settings.showCarNumbers === 'boolean' : true) &&
    ('invertTrackColors' in settings ? typeof settings.invertTrackColors === 'boolean' : true) &&
    ('driverCircleSize' in settings ? typeof settings.driverCircleSize === 'number' : true) &&
    ('playerCircleSize' in settings ? typeof settings.playerCircleSize === 'number' : true) &&
    ('trackLineWidth' in settings ? typeof settings.trackLineWidth === 'number' : true) &&
    ('trackOutlineWidth' in settings ? typeof settings.trackOutlineWidth === 'number' : true) &&
    ('useHighlightColor' in settings ? typeof settings.useHighlightColor === 'boolean' : true)
  ) {
    return settings as TrackMapSettings['config'];
  }

  return undefined;
};
