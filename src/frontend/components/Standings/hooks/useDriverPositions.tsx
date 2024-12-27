import { useMemo } from 'react';
import {
  useTelemetryValue,
  useTelemetry,
  useSessionDrivers,
  useSessionStore,
} from '@irdashies/context';
import { Standings } from '../createStandings';
import { useCurrentSession } from './useCurrentSession';

export const useDriverPositions = () => {
  const carIdxPosition = useTelemetry('CarIdxPosition');
  const carIdxClassPosition = useTelemetry('CarIdxClassPosition');
  const carIdxBestLap = useTelemetry('CarIdxBestLapTime');
  const carIdxLastLap = useTelemetry('CarIdxLastLapTime');
  const carIdxF2Time = useTelemetry('CarIdxF2Time');
  const carIdxLapNum = useTelemetry('CarIdxLap');

  const positions = carIdxPosition?.value?.map((position, carIdx) => ({
    carIdx,
    position,
    classPosition: carIdxClassPosition?.value?.[carIdx],
    delta: carIdxF2Time?.value?.[carIdx], // only to leader currently, need to handle non-race sessions
    bestLap: carIdxBestLap?.value?.[carIdx],
    lastLap: carIdxLastLap?.value?.[carIdx],
    lapNum: carIdxLapNum?.value?.[carIdx],
  }));

  return positions ?? [];
};

export const useDrivers = () => {
  const sessionDrivers = useSessionDrivers();
  const drivers =
    sessionDrivers?.map((driver) => ({
      carIdx: driver.CarIdx,
      name: driver.UserName,
      carNum: driver.CarNumber,
      carNumRaw: driver.CarNumberRaw,
      license: driver.LicString,
      rating: driver.IRating,
      carClass: {
        id: driver.CarClassID,
        color: driver.CarClassColor,
        name: driver.CarClassShortName,
        relativeSpeed: driver.CarClassRelSpeed,
        estLapTime: driver.CarClassEstLapTime,
      },
    })) ?? [];
  return drivers;
};

// Which car is currently active on radio
export const useRadioTransmitCarIndex = () => {
  const radioTransmitCarIdx = useTelemetryValue('RadioTransmitCarIdx');
  return radioTransmitCarIdx;
};

export const useCarState = () => {
  const carIdxTrackSurface = useTelemetry('CarIdxTrackSurface');
  const carIdxOnPitRoad = useTelemetry<boolean[]>('CarIdxOnPitRoad');

  // turn two arrays to one array with object of index and boolean values
  return (
    carIdxTrackSurface?.value?.map((onTrack, index) => ({
      carIdx: index,
      onTrack: onTrack > -1,
      onPitRoad: carIdxOnPitRoad?.value?.[index],
    })) ?? []
  );
};

export const usePlayerCarIndex = () => {
  const playerCarIdx = useSessionStore(
    (state) => state.session?.DriverInfo?.DriverCarIdx
  );
  return playerCarIdx;
};

// TODO: this should eventually replace the useDriverStandings hook
// currently there's still a few bugs to handle but is only used in relative right now
export const useDriverStandings = () => {
  const driverPositions = useDriverPositions();
  const drivers = useDrivers();
  const radioTransmitCarIdx = useRadioTransmitCarIndex();
  const carStates = useCarState();
  const playerCarIdx = usePlayerCarIndex();
  const currentSession = useCurrentSession();

  const driverStandings: Standings[] = useMemo(() => {
    const standings = drivers.map((driver) => {
      const driverPos = driverPositions.find(
        (driverPos) => driverPos.carIdx === driver.carIdx
      );

      if (!driverPos) return undefined;

      const carState = carStates.find((car) => car.carIdx === driver.carIdx);
      const playerLap =
        driverPositions.find((pos) => pos.carIdx === playerCarIdx)?.lapNum ?? 0;

      let lappedState: 'ahead' | 'behind' | 'same' | undefined = undefined;
      if (currentSession?.SessionType === 'Race') {
        if (driverPos.lapNum > playerLap) lappedState = 'ahead';
        if (driverPos.lapNum < playerLap) lappedState = 'behind';
        if (driverPos.lapNum === playerLap) lappedState = 'same';
      }

      // If the driver is not in the standings, use the car number as position
      // This is a crappy workaround for drivers that are not in the standings
      // carIdx is also not available in qualifying (might be just lone qualifying thing)
      let classPosition = driverPos.classPosition;
      if (classPosition <= 0) classPosition = driver.carIdx || driver.carNumRaw;

      return {
        carIdx: driver.carIdx,
        position: driverPos.position,
        lap: driverPos.lapNum,
        lappedState,
        classPosition,
        delta: driverPos.delta,
        isPlayer: playerCarIdx === driver.carIdx,
        driver: {
          name: driver.name,
          carNum: driver.carNum,
          license: driver.license,
          rating: driver.rating,
        },
        fastestTime: driverPos.bestLap,
        hasFastestTime: false, // TODO
        lastTime: driverPos.lastLap,
        onPitRoad: carState?.onPitRoad ?? false,
        onTrack: carState?.onTrack ?? false,
        carClass: driver.carClass,
        radioActive: driverPos.carIdx === radioTransmitCarIdx,
      };
    });

    return standings.filter((s) => !!s).sort((a, b) => a.position - b.position);
  }, [
    carStates,
    currentSession?.SessionType,
    driverPositions,
    drivers,
    playerCarIdx,
    radioTransmitCarIdx,
  ]);

  return driverStandings;
};
