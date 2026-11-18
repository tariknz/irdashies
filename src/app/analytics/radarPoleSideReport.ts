import type { PoleSideOverrides } from '../radarPoleSideOverrides';
import {
  buildHashedTrackReport,
  type HashedTrackReport,
} from './hashedTrackReport';

/** Leave headroom for SDK metadata below PostHog's 1 MB event limit. */
export const MAX_POLE_SIDE_PROPERTIES_BYTES = 512 * 1024;

/**
 * By iRacing track id: the side (true: left) the player chose for a race
 * start, a restart and a standing grid, and what the bundled table said
 * for a start or restart at the time.
 */
interface RadarPoleSideTrack {
  start_left?: boolean;
  restart_left?: boolean;
  grid_left?: boolean;
  table_left?: boolean;
}

/**
 * Only track ids and booleans leave the installation: no names, paths or
 * profile data. The hash ignores key order and the app version, so the same
 * corrections are never reported twice and a later revert still is.
 */
export const buildRadarPoleSideReport = (
  overrides: PoleSideOverrides,
  version: string
): HashedTrackReport<RadarPoleSideTrack> =>
  buildHashedTrackReport(
    overrides,
    version,
    ({ start, restart, grid, table }) => [
      start ?? null,
      restart ?? null,
      grid ?? null,
      table ?? null,
    ],
    ({ start, restart, grid, table }) => ({
      ...(start !== undefined && { start_left: start }),
      ...(restart !== undefined && { restart_left: restart }),
      ...(grid !== undefined && { grid_left: grid }),
      ...(table !== undefined && { table_left: table }),
    })
  );
