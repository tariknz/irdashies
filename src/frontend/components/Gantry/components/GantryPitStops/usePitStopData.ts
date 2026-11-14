import { useMemo, useState } from 'react';
import { usePitStopsSnapshot, useSessionDrivers } from '@irdashies/context';
import {
  buildPitStopRows,
  summarisePitTeams,
  type PitCar,
  type PitStopRow,
  type PitTeamSummary,
} from '@irdashies/domain';
import { sanitizeGantryPitStops } from '@irdashies/types';
import { useGantrySessionData } from '../../hooks/useGantrySessionData';
import { useGantrySettings } from '../../hooks/useGantrySettings';
import { useHeld } from '../../hooks/useGantrySessionHold';

export interface PitClass {
  id: string;
  name: string;
  color: number;
}

export interface PitStopData {
  rows: PitStopRow[];
  summaries: PitTeamSummary[];
  classes: PitClass[];
  playerCarIdx: number | null;
  /** The player's class, or the first class. */
  defaultClassId: string | null;
  /** performance.now() when this data arrived; ages stops in progress. */
  receivedAt: number;
  /** The session the stops were recorded in. */
  sessionNum: number | null;
}

const isEmptyRoster = (drivers: readonly unknown[] | undefined) =>
  !drivers || drivers.length === 0;

/** Stops, the cars that made them and the team summary, for the Pit Stops tab. */
export const usePitStopData = (): PitStopData => {
  const snapshot = usePitStopsSnapshot();
  const { standingsByClass } = useGantrySessionData();
  const roster = useHeld(useSessionDrivers(), isEmptyRoster);
  const settings = useGantrySettings();
  const profiles = useMemo(
    () => sanitizeGantryPitStops(settings?.pitStops).profiles,
    [settings?.pitStops]
  );

  const { cars, classes, playerCarIdx } = useMemo(() => {
    const carPaths = new Map<number, { carPath: string; teamName: string }>();
    for (const driver of roster ?? []) {
      carPaths.set(driver.CarIdx, {
        carPath: driver.CarPath ?? '',
        teamName: driver.TeamName ?? '',
      });
    }
    const cars = new Map<number, PitCar>();
    const classes: PitClass[] = [];
    let playerCarIdx: number | null = null;
    for (const [classId, drivers] of standingsByClass) {
      const first = drivers[0];
      if (first)
        classes.push({
          id: classId,
          name: first.carClass.name,
          color: first.carClass.color,
        });
      for (const standing of drivers) {
        const sessionCar = carPaths.get(standing.carIdx);
        if (standing.isPlayer) playerCarIdx = standing.carIdx;
        cars.set(standing.carIdx, {
          carIdx: standing.carIdx,
          carNumber: standing.driver.carNum,
          teamName:
            standing.driver.teamName ||
            sessionCar?.teamName ||
            standing.driver.name,
          classId: standing.carClass.id,
          className: standing.carClass.name,
          classColor: standing.carClass.color,
          carPath: sessionCar?.carPath ?? '',
          lap: standing.lap ?? 0,
          classPosition: standing.classPosition ?? 0,
          isPlayer: standing.isPlayer,
        });
      }
    }
    return { cars, classes, playerCarIdx };
  }, [standingsByClass, roster]);

  // Stamped once per snapshot: a standings update must not restart timers.
  const [stamp, setStamp] = useState(() => ({
    snapshot,
    at: performance.now(),
  }));
  let receivedAt = stamp.at;
  if (stamp.snapshot !== snapshot) {
    receivedAt = performance.now();
    setStamp({ snapshot, at: receivedAt });
  }

  return useMemo(() => {
    const rows = snapshot
      ? buildPitStopRows(snapshot, cars, profiles, snapshot.sessionTime)
      : [];
    const playerClass =
      playerCarIdx !== null ? cars.get(playerCarIdx)?.classId : undefined;
    return {
      rows,
      summaries: summarisePitTeams(rows, cars, playerCarIdx),
      classes,
      playerCarIdx,
      defaultClassId:
        playerClass !== undefined
          ? String(playerClass)
          : (classes[0]?.id ?? null),
      receivedAt,
      sessionNum: snapshot?.sessionNum ?? null,
    };
  }, [snapshot, cars, classes, playerCarIdx, profiles, receivedAt]);
};
