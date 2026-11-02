import { useStandingsSelector } from '@irdashies/context';

/**
 * The points at which LMU serves a drive-through, or undefined when unknown.
 *
 * A session constant, so it is selected on its own rather than read off the
 * whole standings snapshot: a widget that subscribed to the snapshot for this
 * one number would re-render on every per-car array change.
 *
 * 0 from the channel means the session has not stated a scale, which is not a
 * ceiling of zero -- it becomes undefined here so a consumer cannot treat it
 * as one.
 */
export const useTrackLimitsMax = (): number | undefined => {
  const max = useStandingsSelector((snapshot) => snapshot.trackLimitsPointsMax);
  return typeof max === 'number' && max > 0 ? max : undefined;
};
