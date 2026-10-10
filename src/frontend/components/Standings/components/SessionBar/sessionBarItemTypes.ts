import type { SessionBarConfig } from '@irdashies/types';

export const SESSION_BAR_ITEM_KEYS = [
  'sessionName',
  'sessionTime',
  'sessionLaps',
  'incidentCount',
  'brakeBias',
  'localTime',
  'sessionClockTime',
  'trackWetness',
  'precipitation',
  'airTemperature',
  'trackTemperature',
  'trackName',
  'wind',
  'fuelLevel',
  'lastLap',
  'bestLap',
  'manufacturerPosition',
  'classRank',
  'topSpeed',
] as const;

export type SessionBarItemKey = (typeof SESSION_BAR_ITEM_KEYS)[number];

const SESSION_BAR_ITEM_KEY_SET = new Set<string>(SESSION_BAR_ITEM_KEYS);

export const isSessionBarItemKey = (
  value: unknown
): value is SessionBarItemKey =>
  typeof value === 'string' && SESSION_BAR_ITEM_KEY_SET.has(value);

export interface SessionBarItemProps {
  settings: SessionBarConfig | undefined;
  standalone: boolean;
}
