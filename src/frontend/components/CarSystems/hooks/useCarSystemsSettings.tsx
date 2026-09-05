import { useDashboard } from '@irdashies/context';
import {
  DEFAULT_CAR_SYSTEM_ROWS,
  type CarSystemsConfig,
} from '@irdashies/types';

const FALLBACK: CarSystemsConfig = {
  rows: [...DEFAULT_CAR_SYSTEM_ROWS],
  showUnsupportedRows: true,
  background: { opacity: 80 },
  sessionVisibility: {
    race: true,
    loneQualify: true,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
  showOnlyWhenOnTrack: false,
};

export const useCarSystemsSettings = (): CarSystemsConfig => {
  const { currentDashboard } = useDashboard();

  const settings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'carsystems'
  )?.config;

  if (settings && typeof settings === 'object' && 'rows' in settings) {
    const config = settings as unknown as CarSystemsConfig;
    // A config saved before a row was added to the catalogue simply omits it,
    // so the stored list is used as-is rather than merged with the defaults.
    return { ...FALLBACK, ...config };
  }

  return FALLBACK;
};
