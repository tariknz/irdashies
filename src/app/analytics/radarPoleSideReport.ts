import crypto from 'node:crypto';
import type { PoleSideOverrides } from '../radarPoleSideOverrides';

/** Leave headroom for SDK metadata below PostHog's 1 MB event limit. */
export const MAX_POLE_SIDE_PROPERTIES_BYTES = 512 * 1024;

export interface RadarPoleSideReport {
  /** Identifies the corrections, whatever order or formatting they came in. */
  hash: string;
  properties: {
    version: string;
    data_hash: string;
    track_count: number;
    /**
     * By iRacing track id: the side (true: left) the player chose for a race
     * start and a restart, and what the bundled table said at the time.
     */
    tracks: Record<
      string,
      { start_left?: boolean; restart_left?: boolean; table_left: boolean }
    >;
  };
}

/**
 * Only track ids and booleans leave the installation: no names, paths or
 * profile data. The hash ignores key order and the app version, so the same
 * corrections are never reported twice and a later revert still is.
 */
export const buildRadarPoleSideReport = (
  overrides: PoleSideOverrides,
  version: string
): RadarPoleSideReport => {
  const ids = Object.keys(overrides).sort((a, b) => Number(a) - Number(b));
  const canonical = ids.map((id) => [
    id,
    overrides[id].start ?? null,
    overrides[id].restart ?? null,
    overrides[id].table,
  ]);
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
  const tracks: RadarPoleSideReport['properties']['tracks'] = {};
  for (const id of ids) {
    const { start, restart, table } = overrides[id];
    tracks[id] = {
      ...(start !== undefined && { start_left: start }),
      ...(restart !== undefined && { restart_left: restart }),
      table_left: table,
    };
  }
  return {
    hash,
    properties: {
      version,
      data_hash: hash,
      track_count: ids.length,
      tracks,
    },
  };
};
