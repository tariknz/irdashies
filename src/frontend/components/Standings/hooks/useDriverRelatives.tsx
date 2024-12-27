import { useMemo } from 'react';
import { useTelemetry } from '@irdashies/context';
import {
  useDrivers,
  useDriverStandings,
  usePlayerCarIndex,
} from './useDriverPositions';

const useCarIdxEstTime = () => {
  const { telemetry } = useTelemetry();
  const carIdxEstTime = useMemo(
    () => telemetry?.CarIdxEstTime?.value ?? [],
    [telemetry?.CarIdxEstTime?.value]
  );
  return carIdxEstTime;
};

const useCarIdxLapDistPct = () => {
  const { telemetry } = useTelemetry();
  const carIdxLapDistPct = useMemo(
    () => telemetry?.CarIdxLapDistPct?.value ?? [],
    [telemetry?.CarIdxLapDistPct?.value]
  );
  return carIdxLapDistPct;
};

export const useDriverRelatives = ({ buffer }: { buffer: number }) => {
  const carIdxEstTime = useCarIdxEstTime();
  const carIdxLapDistPct = useCarIdxLapDistPct();
  const drivers = useDrivers();
  const driverStandings = useDriverStandings();
  const playerIndex = usePlayerCarIndex();

  const standings = useMemo(() => {
    const player = drivers.find((result) => result.carIdx === playerIndex);
    const relatives = driverStandings
      .map((result) => {
        // driver class estimate lap time
        const driver = drivers.find((d) => d.carIdx === result.carIdx);
        const lapTimeEst = driver?.carClass.estLapTime;

        let delta = 0.0;
        const driverLapTimeEst = lapTimeEst ?? 0;
        const relativeCarTime = carIdxEstTime[result.carIdx];
        const playerCarTime = carIdxEstTime[player?.carIdx ?? 0];

        // Determine if the delta between player and relative car spans across the start/finish line
        const crossesStartFinishLine =
          Math.abs(
            carIdxLapDistPct[result.carIdx] -
              carIdxLapDistPct[player?.carIdx ?? 0]
          ) > 0.5;

        if (crossesStartFinishLine) {
          delta =
            playerCarTime > relativeCarTime
              ? relativeCarTime - playerCarTime + driverLapTimeEst
              : relativeCarTime - playerCarTime - driverLapTimeEst;
        } else {
          delta = relativeCarTime - playerCarTime;
        }

        return {
          ...result,
          delta,
        };
      })
      .sort((a, b) => b.delta - a.delta);

    // slice the relevant drivers based on the buffer
    const tableIndex = relatives.findIndex(
      (result) => result.carIdx === playerIndex
    );

    const end = Math.min(tableIndex + buffer + 1, relatives.length);
    const start = Math.max(tableIndex - buffer, 0);
    const sliced = relatives.slice(start, end);
    const filtered = sliced.filter(
      (result) => result.onTrack || result.carIdx === playerIndex
    ); // only show drivers on track plus the player

    return filtered;
  }, [
    driverStandings,
    carIdxLapDistPct,
    carIdxEstTime,
    drivers,
    buffer,
    playerIndex,
  ]);

  return standings;
};
