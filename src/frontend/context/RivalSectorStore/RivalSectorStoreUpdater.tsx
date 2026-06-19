import { useEffect, useRef } from 'react';
import {
  useTelemetryValues,
  useTelemetryValue,
} from '../TelemetryStore/TelemetryStore';
import { useSectorTimingStore } from '../SectorTimingStore/SectorTimingStore';
import { useRivalSectorStore } from './RivalSectorStore';

export const useRivalSectorStoreUpdater = (enabled: boolean) => {
  const update = useRivalSectorStore((s) => s.update);
  const reset = useRivalSectorStore((s) => s.reset);
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const carIdxLap = useTelemetryValues('CarIdxLap');
  const sessionTime = useTelemetryValue('SessionTime');
  const sessionNum = useTelemetryValue('SessionNum');
  const sectors = useSectorTimingStore((s) => s.sectors);
  const prevSessionNumRef = useRef<number | undefined | null>(undefined);

  useEffect(() => {
    const prev = prevSessionNumRef.current;
    prevSessionNumRef.current = sessionNum;
    if (prev === undefined || sessionNum === undefined) return;
    if (prev !== sessionNum) reset();
  }, [sessionNum, reset]);

  useEffect(() => {
    if (
      !enabled ||
      !carIdxLapDistPct?.length ||
      !sectors.length ||
      sessionTime === undefined
    )
      return;
    update({
      carIdxLapDistPct: carIdxLapDistPct as number[],
      carIdxLap: (carIdxLap ?? []) as number[],
      sessionTime,
      sessionNum: sessionNum ?? null,
      sectors,
    });
  }, [enabled, carIdxLapDistPct, carIdxLap, sessionTime, sessionNum, sectors, update]);
};
