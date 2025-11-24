import { useMemo } from 'react';
import {
  useTelemetryValue,
  useTelemetry,
  useSessionDrivers,
  useSessionQualifyingResults,
  useCurrentSessionType,
  useCarLap,
  usePitLap,
  usePrevCarTrackSurface,
  useFocusCarIdx,
} from '@irdashies/context';

import { Standings, type LastTimeState } from '../createStandings';
import { GlobalFlags } from '../../../../app/irsdk/types';

const getLastTimeState = (
  lastTime: number | undefined,
  fastestTime: number | undefined,
  hasFastestTime: boolean
): LastTimeState => {
  if (lastTime !== undefined && fastestTime !== undefined && lastTime === fastestTime) {
    return hasFastestTime ? 'session-fastest' : 'personal-best';
  }
  return undefined;
};

export const useDriverPositions = () => {
  const carIdxPosition = useTelemetry('CarIdxPosition');
  const carIdxClassPosition = useTelemetry('CarIdxClassPosition');
  const carIdxBestLap = useTelemetry('CarIdxBestLapTime');
  const carIdxLastLapTime = useTelemetry('CarIdxLastLapTime');
  const carIdxF2Time = useTelemetry('CarIdxF2Time');
  const carIdxLapNum = useTelemetry('CarIdxLap');
  const carIdxTrackSurface = useTelemetry('CarIdxTrackSurface');
  const prevCarTrackSurface = usePrevCarTrackSurface()
  const lastPitLap = usePitLap()
  const lastLap = useCarLap()


  const positions = useMemo(() => {
    return carIdxPosition?.value?.map((position, carIdx) => ({
      carIdx,
      position,
      classPosition: carIdxClassPosition?.value?.[carIdx],
      delta: carIdxF2Time?.value?.[carIdx], // only to leader currently, need to handle non-race sessions
      bestLap: carIdxBestLap?.value?.[carIdx],
      lastLap: lastLap[carIdx] ?? -1,
      lastLapTime: carIdxLastLapTime?.value?.[carIdx] ?? -1,
      lapNum: carIdxLapNum?.value?.[carIdx],
      lastPitLap: lastPitLap[carIdx] ?? undefined,
      prevCarTrackSurface: prevCarTrackSurface[carIdx] ?? undefined,
      carTrackSurface: carIdxTrackSurface?.value?.[carIdx]
    })) ?? [];
  }, [
    carIdxPosition?.value,
    carIdxClassPosition?.value,
    carIdxBestLap?.value,
    carIdxLastLapTime?.value,
    lastLap,
    carIdxF2Time?.value,
    carIdxLapNum?.value,
    lastPitLap,
    prevCarTrackSurface,
    carIdxTrackSurface?.value
  ]);

  return positions;
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
      flairId: driver.FlairID,
      carClass: {
        id: driver.CarClassID,
        color: driver.CarClassColor,
        name: driver.CarClassShortName,
        relativeSpeed: driver.CarClassRelSpeed,
        estLapTime: driver.CarClassEstLapTime,
      },
      carId: driver.CarID
    })) ?? [];
  return drivers;
};

export const useCarState = () => {
  const carIdxTrackSurface = useTelemetry('CarIdxTrackSurface');
  const carIdxOnPitRoad = useTelemetry<boolean[]>('CarIdxOnPitRoad');
  const carIdxTireCompound = useTelemetry<number[]>('CarIdxTireCompound');
  const carIdxSessionFlags = useTelemetry<number[]>('CarIdxSessionFlags');

  return useMemo(() => {
    return carIdxTrackSurface?.value?.map((onTrack, index) => ({
      carIdx: index,
      onTrack: onTrack > -1,
      onPitRoad: carIdxOnPitRoad?.value?.[index],
      tireCompound: carIdxTireCompound?.value?.[index],
      dnf: !!((carIdxSessionFlags?.value?.[index] ?? 0) & GlobalFlags.Disqualify),
      repair: !!((carIdxSessionFlags?.value?.[index] ?? 0) & GlobalFlags.Repair)
    })) ?? [];
  }, [carIdxTrackSurface?.value, carIdxOnPitRoad?.value, carIdxTireCompound?.value]);
};

// TODO: this should eventually replace the useDriverStandings hook
// currently there's still a few bugs to handle but is only used in relative right now
export const useDriverStandings = () => {
  const driverPositions = useDriverPositions();
  const drivers = useDrivers();
  const radioTransmitCarIdx = useTelemetryValue('RadioTransmitCarIdx');
  const carStates = useCarState();
  // Use focus car index which handles spectator mode (uses CamCarIdx when spectating)
  const playerCarIdx = useFocusCarIdx();
  const sessionType = useCurrentSessionType();
  const qualifyingPositions = useSessionQualifyingResults();

  const driverStandings: Standings[] = useMemo(() => {
    const fastestTime = driverPositions.reduce((fastest, pos) => {
      if (pos.bestLap !== undefined && pos.bestLap > 0) {
        return fastest === undefined || pos.bestLap < fastest ? pos.bestLap : fastest;
      }
      return fastest;
    }, undefined as number | undefined);

    // Create Map lookups for O(1) access instead of O(n) find() calls
    const driverPositionsByCarIdx = new Map(driverPositions.map(pos => [pos.carIdx, pos]));
    const carStatesByCarIdx = new Map(carStates.map(state => [state.carIdx, state]));
    const qualifyingPositionsByCarIdx = qualifyingPositions
      ? new Map(qualifyingPositions.map(q => [q.CarIdx, q]))
      : new Map();

    const playerLap = playerCarIdx !== undefined
      ? driverPositionsByCarIdx.get(playerCarIdx)?.lapNum ?? 0
      : 0;

    const standings = drivers.map((driver) => {
      const driverPos = driverPositionsByCarIdx.get(driver.carIdx);

      if (!driverPos) return undefined;

      const carState = carStatesByCarIdx.get(driver.carIdx);

      let lappedState: 'ahead' | 'behind' | 'same' | undefined = undefined;
      if (sessionType === 'Race') {
        if (driverPos.lapNum > playerLap) lappedState = 'ahead';
        if (driverPos.lapNum < playerLap) lappedState = 'behind';
        if (driverPos.lapNum === playerLap) lappedState = 'same';
      }

      // If the driver is not in the standings, use the qualifying position
      let classPosition: number | undefined = driverPos.classPosition;
      if (classPosition <= 0) {
        const qualifyingPosition = qualifyingPositionsByCarIdx.get(driver.carIdx);
        classPosition = qualifyingPosition ? qualifyingPosition.Position + 1 : undefined;
      }

      const hasFastestTime = driverPos.bestLap !== undefined && 
                             fastestTime !== undefined && 
                             driverPos.bestLap === fastestTime;

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
          flairId: driver.flairId,
        },
        fastestTime: driverPos.bestLap,
        hasFastestTime,
        lastTime: driverPos.lastLapTime,
        lastTimeState: getLastTimeState(
          driverPos.lastLapTime,
          driverPos.bestLap,
          hasFastestTime
        ),
        onPitRoad: carState?.onPitRoad ?? false,
        onTrack: carState?.onTrack ?? false,
        tireCompound: carState?.tireCompound ?? 0,
        carClass: driver.carClass,
        radioActive: driverPos.carIdx === radioTransmitCarIdx,
        carId: driver.carId,
        lastPitLap: driverPos.lastPitLap,
        lastLap: driverPos.lastLap,
        prevCarTrackSurface: driverPos.prevCarTrackSurface,
        carTrackSurface: driverPos.carTrackSurface,
        currentSessionType: sessionType,
        dnf: carState?.dnf ?? false,
        repair: carState?.repair ?? false
      };
    });

    return standings.filter((s) => !!s).sort((a, b) => a.position - b.position);
  }, [
    carStates,
    driverPositions,
    drivers,
    playerCarIdx,
    qualifyingPositions,
    radioTransmitCarIdx,
    sessionType,
  ]);

  return driverStandings;
};
