import type { ComponentType } from 'react';
import type { SessionBarConfig } from '@irdashies/types';
import { SessionNameItem } from './components/SessionNameItem/SessionNameItem';
import { SessionTimeItem } from './components/SessionTimeItem/SessionTimeItem';
import { SessionLapsItem } from './components/SessionLapsItem/SessionLapsItem';
import { IncidentCountItem } from './components/IncidentCountItem/IncidentCountItem';
import { BrakeBiasItem } from './components/BrakeBiasItem/BrakeBiasItem';
import { LocalTimeItem } from './components/LocalTimeItem/LocalTimeItem';
import { SessionClockTimeItem } from './components/SessionClockTimeItem/SessionClockTimeItem';
import { TrackWetnessItem } from './components/TrackWetnessItem/TrackWetnessItem';
import { PrecipitationItem } from './components/PrecipitationItem/PrecipitationItem';
import { AirTemperatureItem } from './components/AirTemperatureItem/AirTemperatureItem';
import { TrackTemperatureItem } from './components/TrackTemperatureItem/TrackTemperatureItem';
import { TrackNameItem } from './components/TrackNameItem/TrackNameItem';
import { WindItem } from './components/WindItem/WindItem';
import { FuelLevelItem } from './components/FuelLevelItem/FuelLevelItem';
import { LastLapItem } from './components/LastLapItem/LastLapItem';
import { BestLapItem } from './components/BestLapItem/BestLapItem';
import { ManufacturerPositionItem } from './components/ManufacturerPositionItem/ManufacturerPositionItem';
import { ClassRankItem } from './components/ClassRankItem/ClassRankItem';
import { TopSpeedItem } from './components/TopSpeedItem/TopSpeedItem';
import type {
  SessionBarItemKey,
  SessionBarItemProps,
} from './sessionBarItemTypes';

export const SESSION_BAR_ITEM_COMPONENTS: Record<
  SessionBarItemKey,
  ComponentType<SessionBarItemProps>
> = {
  sessionName: SessionNameItem,
  sessionTime: SessionTimeItem,
  sessionLaps: SessionLapsItem,
  incidentCount: IncidentCountItem,
  brakeBias: BrakeBiasItem,
  localTime: LocalTimeItem,
  sessionClockTime: SessionClockTimeItem,
  trackWetness: TrackWetnessItem,
  precipitation: PrecipitationItem,
  airTemperature: AirTemperatureItem,
  trackTemperature: TrackTemperatureItem,
  trackName: TrackNameItem,
  wind: WindItem,
  fuelLevel: FuelLevelItem,
  lastLap: LastLapItem,
  bestLap: BestLapItem,
  manufacturerPosition: ManufacturerPositionItem,
  classRank: ClassRankItem,
  topSpeed: TopSpeedItem,
};

// Position-dependent default-enabled rules, transcribed 1:1 from the original
// inline itemDefinitions `enabled` checks.
const DEFAULT_ENABLED: Record<
  SessionBarItemKey,
  (position: 'header' | 'footer') => boolean
> = {
  sessionName: (position) => position === 'header',
  sessionTime: (position) => position === 'header',
  sessionLaps: () => true,
  incidentCount: (position) => position === 'header',
  brakeBias: () => true,
  localTime: () => true,
  sessionClockTime: () => false,
  trackWetness: (position) => position !== 'header',
  precipitation: () => false,
  airTemperature: (position) => position !== 'header',
  trackTemperature: (position) => position !== 'header',
  trackName: () => false,
  wind: () => false,
  fuelLevel: () => false,
  lastLap: () => false,
  bestLap: () => false,
  manufacturerPosition: () => false,
  classRank: () => false,
  topSpeed: () => false,
};

export const isSessionBarItemEnabled = (
  key: SessionBarItemKey,
  settings: SessionBarConfig | undefined,
  position: 'header' | 'footer'
): boolean => {
  const slice = (
    settings as Record<string, { enabled?: boolean }> | undefined
  )?.[key];
  return slice?.enabled ?? DEFAULT_ENABLED[key](position);
};

export const DEFAULT_DISPLAY_ORDER: Record<
  'header' | 'footer',
  SessionBarItemKey[]
> = {
  header: [
    'sessionName',
    'sessionTime',
    'sessionLaps',
    'localTime',
    'brakeBias',
    'incidentCount',
  ],
  footer: [
    'localTime',
    'trackWetness',
    'sessionLaps',
    'airTemperature',
    'trackTemperature',
  ],
};
