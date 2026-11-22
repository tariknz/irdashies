import { DEMO_GROUPS } from '@irdashies/domain/broadcast/demoField';
import type { Standings } from '@irdashies/domain';

/** Rotates class order and highlights so the podium card keeps moving. */
export const getDemoPodiumGroups = (
  elapsedSec = 0
): [string, Standings[]][] => {
  const step = Math.floor(elapsedSec / 4);
  return DEMO_GROUPS.map(([classId, cars], groupIndex) => {
    const rotated = cars.map((car, i) => {
      const classPosition = ((i + step) % cars.length) + 1;
      return {
        ...car,
        classPosition,
        position: groupIndex * 10 + classPosition,
        radioActive: (i + step) % cars.length === 0,
        onPitRoad: (i + step) % cars.length === cars.length - 1,
        positionChange: ((i + step) % 3) - 1,
      } as Standings;
    });
    rotated.sort((a, b) => (a.classPosition ?? 0) - (b.classPosition ?? 0));
    return [classId, rotated] as [string, Standings[]];
  });
};
