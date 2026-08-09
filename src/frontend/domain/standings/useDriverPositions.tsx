import { useMemo } from 'react';
import {
  useStandingsSnapshot,
  useSessionTimingSnapshot,
  useSessionDrivers,
  useSessionQualifyingResults,
  useSessionIsOfficial,
  useCurrentSessionType,
  useCarLap,
  useFocusCarIdx,
  useSessionPositions,
  useSessionFastestLaps,
} from '@irdashies/context';

import {
  Standings,
  augmentStandingsWithIRating,
  groupStandingsByClass,
  type LastTimeState,
} from './createStandings';
import { GlobalFlags, SessionState } from '@irdashies/types';
import { useDriverLivePositions } from './useDriverLivePositions';
import { useRelativeSettings } from './useRelativeSettings';
import { useRadioActiveCarIdxs } from './useRadioActiveCarIdxs';

const EMPTY_NUMBERS: number[] = [];
const EMPTY_BOOLEANS: boolean[] = [];
const EMPTY_OPTIONAL_NUMBERS: (number | undefined)[] = [];

const getLastTimeState = (
  lastTime: number | undefined,
  fastestTime: number | undefined,
  hasFastestTime: boolean
): LastTimeState => {
  if (
    lastTime !== undefined &&
    fastestTime !== undefined &&
    lastTime === fastestTime
  ) {
    return hasFastestTime ? 'session-fastest' : 'personal-best';
  }
  return undefined;
};

export const useDriverPositions = () => {
  const snapshot = useStandingsSnapshot();
  const carIdxPosition = snapshot?.carIdxPosition ?? EMPTY_NUMBERS;
  const carIdxClassPosition = snapshot?.carIdxClassPosition ?? EMPTY_NUMBERS;
  const carIdxBestLap = snapshot?.carIdxBestLapTime ?? EMPTY_NUMBERS;
  const carIdxLastLapTime = snapshot?.carIdxLastLapTime ?? EMPTY_NUMBERS;
  const carIdxF2Time = snapshot?.carIdxF2Time ?? EMPTY_NUMBERS;
  const carIdxLapNum = snapshot?.carIdxLap ?? EMPTY_NUMBERS;
  const carIdxTrackSurface = snapshot?.carIdxTrackSurface ?? EMPTY_NUMBERS;
  const prevCarTrackSurface =
    snapshot?.previousCarTrackSurface ?? EMPTY_OPTIONAL_NUMBERS;
  const lastPitLap = snapshot?.lastPitLap ?? EMPTY_OPTIONAL_NUMBERS;
  const lastLap = useCarLap();
  const carIdxLapDstPct = snapshot?.carIdxLapDistPct ?? EMPTY_NUMBERS;

  const positions = useMemo(() => {
    return (
      carIdxPosition.map((position, carIdx) => ({
        carIdx,
        position,
        classPosition: carIdxClassPosition[carIdx],
        delta: carIdxF2Time[carIdx], // only to leader currently, need to handle non-race sessions
        bestLap: carIdxBestLap[carIdx],
        lastLap: lastLap[carIdx] ?? -1,
        lastLapTime: carIdxLastLapTime[carIdx] ?? -1,
        lapNum: carIdxLapNum[carIdx],
        lapDstPct: carIdxLapDstPct[carIdx] ?? 0,
        lastPitLap: lastPitLap[carIdx] ?? undefined,
        prevCarTrackSurface: prevCarTrackSurface[carIdx] ?? undefined,
        carTrackSurface: carIdxTrackSurface[carIdx],
      })) ?? []
    );
  }, [
    carIdxPosition,
    carIdxClassPosition,
    carIdxBestLap,
    carIdxLastLapTime,
    lastLap,
    carIdxF2Time,
    carIdxLapNum,
    carIdxLapDstPct,
    lastPitLap,
    prevCarTrackSurface,
    carIdxTrackSurface,
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
      teamName: driver.TeamName,
      carClass: {
        id: driver.CarClassID,
        color: driver.CarClassColor,
        name: driver.CarClassShortName,
        relativeSpeed: driver.CarClassRelSpeed,
        estLapTime: driver.CarClassEstLapTime,
      },
      carId: driver.CarID,
    })) ?? [];
  return drivers;
};

export const useCarState = () => {
  const snapshot = useStandingsSnapshot();
  const carIdxTrackSurface = snapshot?.carIdxTrackSurface ?? EMPTY_NUMBERS;
  const carIdxOnPitRoad = snapshot?.carIdxOnPitRoad ?? EMPTY_BOOLEANS;
  const carIdxTireCompound = snapshot?.carIdxTireCompound ?? EMPTY_NUMBERS;
  const carIdxSessionFlags = snapshot?.carIdxSessionFlags ?? EMPTY_NUMBERS;

  return useMemo(() => {
    return (
      carIdxTrackSurface.map((onTrack, index) => ({
        carIdx: index,
        onTrack: onTrack > -1,
        onPitRoad: carIdxOnPitRoad[index],
        tireCompound: carIdxTireCompound[index],
        dnf: !!((carIdxSessionFlags[index] ?? 0) & GlobalFlags.Disqualify),
        repair: !!((carIdxSessionFlags[index] ?? 0) & GlobalFlags.Repair),
        penalty: !!((carIdxSessionFlags[index] ?? 0) & GlobalFlags.Black),
        slowdown: !!((carIdxSessionFlags[index] ?? 0) & GlobalFlags.Furled),
      })) ?? []
    );
  }, [
    carIdxTrackSurface,
    carIdxOnPitRoad,
    carIdxTireCompound,
    carIdxSessionFlags,
  ]);
};

// TODO: this should eventually replace the useDriverStandings hook
// currently there's still a few bugs to handle but is only used in relative right now
export const useDriverStandings = () => {
  const driverPositions = useDriverPositions();
  const relativeSettings = useRelativeSettings();
  const useLivePositionStandings = relativeSettings?.useLivePosition ?? false;
  const driverLivePositions = useDriverLivePositions({
    enabled: useLivePositionStandings,
  });
  const drivers = useDrivers();
  const radioActiveCarIdxs = useRadioActiveCarIdxs(
    (relativeSettings?.radio?.persistenceSeconds ?? 3) * 1000
  );
  const carStates = useCarState();
  // Use focus car index which handles spectator mode (uses CamCarIdx when spectating)
  const playerCarIdx = useFocusCarIdx();
  const sessionType = useCurrentSessionType();
  const qualifyingPositions = useSessionQualifyingResults();
  const timing = useSessionTimingSnapshot();
  const sessionState = timing?.state ?? 0;
  const sessionNum = timing?.sessionNum;
  const sessionPositions = useSessionPositions(sessionNum ?? undefined);
  const sessionFastestLaps = useSessionFastestLaps(sessionNum ?? undefined);
  const fastestLapCarIdx = sessionFastestLaps?.[0]?.CarIdx;
  const isOfficial = useSessionIsOfficial();

  const driverStandings: Standings[] = useMemo(() => {
    // Create Map lookups for O(1) access instead of O(n) find() calls
    const driverPositionsByCarIdx = new Map(
      driverPositions.map((pos) => [pos.carIdx, pos])
    );
    const carStatesByCarIdx = new Map(
      carStates.map((state) => [state.carIdx, state])
    );
    const sessionPositionsMap = new Map(
      sessionPositions?.map((position) => [position.CarIdx, position]) ?? []
    );
    const qualifyingPositionsByCarIdx =
      qualifyingPositions && Array.isArray(qualifyingPositions)
        ? new Map(qualifyingPositions.map((q) => [q.CarIdx, q]))
        : new Map();

    const playerLap =
      playerCarIdx !== undefined
        ? (driverPositionsByCarIdx.get(playerCarIdx)?.lapNum ?? 0)
        : 0;
    const playerLapDistPct =
      playerCarIdx !== undefined
        ? (driverPositionsByCarIdx.get(playerCarIdx)?.lapDstPct ?? 0)
        : 0;

    const standings = drivers.map((driver) => {
      const driverPos = driverPositionsByCarIdx.get(driver.carIdx);

      if (!driverPos) return undefined;

      const carState = carStatesByCarIdx.get(driver.carIdx);

      let lappedState: 'ahead' | 'behind' | 'same' | undefined = undefined;
      if (sessionType === 'Race') {
        const lapDiff = Math.round(
          driverPos.lapNum +
            driverPos.lapDstPct -
            (playerLap + playerLapDistPct)
        );
        if (lapDiff > 0) lappedState = 'ahead';
        if (lapDiff < 0) lappedState = 'behind';
        if (lapDiff === 0) lappedState = 'same';
      }

      // If the driver is not in the standings, use the qualifying position
      let classPosition: number | undefined = driverPos.classPosition;

      if (useLivePositionStandings) {
        // Override position with live position based on telemetry
        const livePosition = driverLivePositions[driver.carIdx];
        if (livePosition !== undefined) classPosition = livePosition;
      }

      if (!classPosition || !isFinite(classPosition) || classPosition <= 0) {
        // Class position can become 0 or negative in some edge cases
        // Before race start it seems to be fine to default to qualifying position
        // During the race class position should be available
        // After the race we can fallback to session position
        if (sessionState !== SessionState.CoolDown) {
          const qualifyingPosition = qualifyingPositionsByCarIdx.get(
            driver.carIdx
          );
          classPosition = qualifyingPosition
            ? qualifyingPosition.ClassPosition + 1
            : undefined;
        } else {
          const sessionPosition = sessionPositionsMap.get(driver.carIdx);
          classPosition = sessionPosition
            ? sessionPosition.ClassPosition + 1
            : undefined;
        }
      }

      const hasFastestTime =
        fastestLapCarIdx !== undefined && driver.carIdx === fastestLapCarIdx;

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
          teamName: driver.teamName,
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
        radioActive: radioActiveCarIdxs.includes(driverPos.carIdx),
        carId: driver.carId,
        lastPitLap: driverPos.lastPitLap,
        lastLap: driverPos.lastLap,
        prevCarTrackSurface: driverPos.prevCarTrackSurface,
        carTrackSurface: driverPos.carTrackSurface,
        currentSessionType: sessionType,
        dnf: carState?.dnf ?? false,
        repair: carState?.repair ?? false,
        penalty: carState?.penalty ?? false,
        slowdown: carState?.slowdown ?? false,
        relativePct: 0,
      };
    });

    const filteredStandings = standings
      .filter((s) => !!s)
      .sort((a, b) => a.position - b.position);

    if (sessionType !== 'Race' || !isOfficial) {
      return filteredStandings;
    }

    return augmentStandingsWithIRating(groupStandingsByClass(filteredStandings))
      .flatMap(([, classStandings]) => classStandings)
      .sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0));
  }, [
    sessionPositions,
    sessionState,
    driverPositions,
    carStates,
    qualifyingPositions,
    playerCarIdx,
    drivers,
    sessionType,
    useLivePositionStandings,
    radioActiveCarIdxs,
    driverLivePositions,
    fastestLapCarIdx,
    isOfficial,
  ]);

  return driverStandings;
};
