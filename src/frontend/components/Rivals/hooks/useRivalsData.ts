import { useMemo } from 'react';
import { useFocusCarIdx } from '@irdashies/context';
import { useDriverRelatives } from '../../Standings/hooks';
import { Standings } from '../../Standings/createStandings';

export interface RivalEntry extends Standings {
  lastTimeDiff: number | undefined;
  bestTimeDiff: number | undefined;
}

export const useRivalsData = (): {
  ahead: RivalEntry | undefined;
  behind: RivalEntry | undefined;
} => {
  // Large buffer so we find the nearest same-class car even if many other-class
  // cars sit between us and them on the relative timeline.
  const allRelatives = useDriverRelatives({ buffer: 64 });
  const focusCarIdx = useFocusCarIdx();

  return useMemo(() => {
    const player = allRelatives.find((d) => d.carIdx === focusCarIdx);
    if (!player) return { ahead: undefined, behind: undefined };

    const playerClassId = player.carClass.id;
    const playerLastTime = player.lastTime > 0 ? player.lastTime : undefined;
    const playerBestTime = player.fastestTime > 0 ? player.fastestTime : undefined;

    const sameClassOthers = allRelatives.filter(
      (d) => d.carIdx !== focusCarIdx && d.carClass.id === playerClassId
    );

    // relativePct > 0 means the car is ahead of us on track
    const aheadCars = sameClassOthers.filter((d) => d.relativePct > 0);
    const behindCars = sameClassOthers.filter((d) => d.relativePct < 0);

    const toRivalEntry = (d: Standings): RivalEntry => ({
      ...d,
      lastTimeDiff:
        playerLastTime !== undefined && d.lastTime > 0
          ? d.lastTime - playerLastTime
          : undefined,
      bestTimeDiff:
        playerBestTime !== undefined && d.fastestTime > 0
          ? d.fastestTime - playerBestTime
          : undefined,
    });

    // Closest ahead = smallest positive relativePct
    const aheadRival =
      aheadCars.length > 0
        ? toRivalEntry(
            aheadCars.reduce((min, d) =>
              d.relativePct < min.relativePct ? d : min
            )
          )
        : undefined;

    // Closest behind = largest negative relativePct (least negative)
    const behindRival =
      behindCars.length > 0
        ? toRivalEntry(
            behindCars.reduce((max, d) =>
              d.relativePct > max.relativePct ? d : max
            )
          )
        : undefined;

    return { ahead: aheadRival, behind: behindRival };
  }, [allRelatives, focusCarIdx]);
};
