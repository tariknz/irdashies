import {
  RADAR_PROFILE_KEYS,
  type RadarConfig,
  type RadarProfileConfig,
  type RadarProfileKey,
} from '@irdashies/types';

export type RadarProfileId = 'road' | 'oval';

/** WeekendInfo.TrackType: "road course", "oval", "dirt oval", "dirt road". */
export const isOvalTrack = (trackType: string | undefined): boolean =>
  /oval/i.test(trackType ?? '');

const PROFILE_KEY_SET: ReadonlySet<string> = new Set(RADAR_PROFILE_KEYS);

export const isProfileKey = (key: string): key is RadarProfileKey =>
  PROFILE_KEY_SET.has(key);

const pickProfile = (config: RadarConfig): RadarProfileConfig =>
  Object.fromEntries(
    RADAR_PROFILE_KEYS.map((key) => [key, config[key]])
  ) as RadarProfileConfig;

/**
 * The config as one profile sees it. The oval profile starts as a copy of
 * the road one and keeps only what was changed for it.
 */
export const profileView = (
  config: RadarConfig,
  profile: RadarProfileId
): RadarConfig => {
  if (profile === 'road' || !config.ovalProfile) return config;
  const oval = Object.fromEntries(
    Object.entries(config.ovalProfile).filter(
      ([key, value]) => isProfileKey(key) && value !== undefined
    )
  );
  return { ...config, ...oval };
};

/** The profile the radar uses at a track of this type. */
export const activeProfile = (
  config: RadarConfig,
  trackType: string | undefined
): RadarProfileId =>
  config.autoProfile && isOvalTrack(trackType) ? 'oval' : 'road';

/**
 * Applies a change made while editing `profile`. Profile settings edited on
 * the oval land in `ovalProfile`; everything else is shared.
 */
export const applyProfileChange = (
  config: RadarConfig,
  profile: RadarProfileId,
  change: Partial<RadarConfig>
): Partial<RadarConfig> => {
  if (profile === 'road') return change;
  const shared: Partial<RadarConfig> = {};
  const oval: Partial<RadarProfileConfig> = {
    ...(config.ovalProfile ?? pickProfile(config)),
  };
  for (const [key, value] of Object.entries(change)) {
    if (isProfileKey(key)) (oval as Record<string, unknown>)[key] = value;
    else (shared as Record<string, unknown>)[key] = value;
  }
  return { ...shared, ovalProfile: oval };
};
