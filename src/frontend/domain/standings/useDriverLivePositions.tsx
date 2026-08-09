import { useStandingsSnapshot } from '@irdashies/context';

const EMPTY_POSITIONS: Record<number, number> = {};

/** Returns processor-derived live in-class positions indexed by CarIdx. */
export const useDriverLivePositions = ({
  enabled,
}: {
  enabled: boolean;
}): Record<number, number> => {
  const snapshot = useStandingsSnapshot(enabled);
  return enabled && snapshot
    ? (snapshot.liveClassPosition as Record<number, number>)
    : EMPTY_POSITIONS;
};
