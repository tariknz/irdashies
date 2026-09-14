/**
 * Extracts the handful of session fields the importer needs from the .ibt's
 * YAML string: track identity + length (to key the lap and build the bucket
 * grid) and the player's car path.
 */
import * as yaml from 'js-yaml';
import type { Session } from '@irdashies/types';
import type { IbtSessionMeta } from './ibtTypes';
import { IbtImportError } from './ibtErrors';
import logger from '../logger';

/** Parse "3.70 km" / "1234.5 m" into metres. Mirrors ReferenceLapProcessor. */
const trackLengthToMetres = (value: string | undefined): number => {
  const [num, unit] = value?.split(' ') ?? [];
  const parsed = Number.parseFloat(num);
  if (!Number.isFinite(parsed)) return 0;
  return unit === 'km' ? parsed * 1000 : parsed;
};

export const parseIbtSessionInfo = (yamlText: string): IbtSessionMeta => {
  let session: Session;
  try {
    session = yaml.load(yamlText, { json: true }) as Session;
  } catch (e) {
    logger.warn('[Main] Failed to parse .ibt session YAML', e);
    throw new IbtImportError(
      'no-session-info',
      'The .ibt file has no readable session information'
    );
  }

  const weekend = session?.WeekendInfo;
  const driverInfo = session?.DriverInfo;
  if (!weekend || !driverInfo) {
    throw new IbtImportError(
      'no-session-info',
      'The .ibt file is missing WeekendInfo/DriverInfo'
    );
  }

  const trackLengthM = trackLengthToMetres(weekend.TrackLength);
  const playerCarIdx = driverInfo.DriverCarIdx ?? -1;
  const player = (driverInfo.Drivers ?? []).find(
    (d) => d?.CarIdx === playerCarIdx
  );

  const trackId = weekend.TrackID ?? -1;
  const carPath = player?.CarPath ?? '';
  if (trackId <= 0 || !carPath || trackLengthM <= 0) {
    throw new IbtImportError(
      'no-session-info',
      'The .ibt file is missing track/car identity or track length'
    );
  }

  return {
    trackId,
    trackConfigName: weekend.TrackConfigName ?? '',
    carPath,
    trackLengthM,
    trackDisplayName: weekend.TrackDisplayName ?? weekend.TrackName,
    driverName: player?.UserName,
    carScreenName: player?.CarScreenName,
  };
};
