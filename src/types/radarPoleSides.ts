import poleSidesData from './radarPoleSides.json';

/**
 * Which side the pole line of a pace field is on, per track.
 *
 * iRacing does not say and the Sporting Code names no side, so this is data:
 * `radarPoleSides.json`, bundled at build time; the app never fetches it.
 * Pole sits on the inside of the first corner, which
 * `npm run generate-radar-pole-sides` reads from the track drawings
 * (source "geometry"). A side confirmed by driving is "verified" and one
 * gathered from users' own corrections is "reported"; both are kept when the
 * file is regenerated. To correct a track, edit its entry to "verified" with
 * the side you saw, or add a TrackName under `trackNames`.
 */
export type PoleSideSource = 'geometry' | 'verified' | 'reported';

/** iRacing's own start and restart flags for a track: a hint, never the answer. */
export interface IracingPoleHint {
  start: boolean;
  restart: boolean;
}

export interface RadarPoleSides {
  /** Bumped when the shape changes, so a newer file is never half-read. */
  version: 1;
  /** By iRacing `WeekendInfo.TrackID`. */
  tracks: Readonly<
    Record<
      string,
      {
        poleLeft: boolean;
        source: PoleSideSource;
        /** Track and layout, for people reading the file. */
        name?: string;
        iracing?: IracingPoleHint;
      }
    >
  >;
  /** By `WeekendInfo.TrackName`, for tracks without a usable id entry. */
  trackNames: Readonly<Record<string, boolean>>;
}

/** Longer names are not a track's; they are dropped. */
const MAX_NAME = 120;

/** Keeps what is well formed and drops the rest; never throws. */
export const parseRadarPoleSides = (raw: unknown): RadarPoleSides => {
  const empty: RadarPoleSides = { version: 1, tracks: {}, trackNames: {} };
  if (!raw || typeof raw !== 'object') return empty;
  const data = raw as Record<string, unknown>;
  if (data.version !== 1) return empty;
  const tracks: Record<string, RadarPoleSides['tracks'][string]> = {};
  for (const [id, entry] of Object.entries(
    (data.tracks ?? {}) as Record<string, unknown>
  )) {
    const value = entry as {
      poleLeft?: unknown;
      source?: unknown;
      name?: unknown;
      iracing?: { start?: unknown; restart?: unknown } | null;
    } | null;
    if (
      /^\d+$/.test(id) &&
      typeof value?.poleLeft === 'boolean' &&
      value.source !== undefined
    ) {
      // A source a newer file invents is still a usable side: read it as the
      // weakest known one instead of dropping the entry.
      tracks[id] = {
        poleLeft: value.poleLeft,
        source:
          value.source === 'verified' || value.source === 'reported'
            ? value.source
            : 'geometry',
        ...(typeof value.name === 'string' &&
          value.name.length <= MAX_NAME && { name: value.name }),
        ...(typeof value.iracing?.start === 'boolean' &&
          typeof value.iracing.restart === 'boolean' && {
            iracing: {
              start: value.iracing.start,
              restart: value.iracing.restart,
            },
          }),
      };
    }
  }
  const trackNames: Record<string, boolean> = {};
  for (const [name, poleLeft] of Object.entries(
    (data.trackNames ?? {}) as Record<string, unknown>
  )) {
    if (typeof poleLeft === 'boolean') trackNames[name] = poleLeft;
  }
  return { version: 1, tracks, trackNames };
};

export const RADAR_POLE_SIDES = parseRadarPoleSides(poleSidesData);

/**
 * The pole side for a road course, or undefined when nothing is known. A
 * track name wins over the id: it is how a one-off correction is written.
 */
export const poleLeftForTrack = (
  trackId: number | undefined,
  trackName: string | undefined,
  sides: RadarPoleSides = RADAR_POLE_SIDES
): boolean | undefined =>
  (trackName !== undefined
    ? Object.hasOwn(sides.trackNames, trackName)
      ? sides.trackNames[trackName]
      : undefined
    : undefined) ??
  (trackId !== undefined ? sides.tracks[String(trackId)]?.poleLeft : undefined);
