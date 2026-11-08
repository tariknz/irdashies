import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Session, Telemetry } from '../../src/types';
import { LapTimesProcessor } from '../../src/app/processors/LapTimesProcessor';
import { useLapTimesStore } from '../../src/frontend/context/LapTimesStore/LapTimesStore';
import { useCarIdxRollingAvgLapTime } from '../../src/frontend/context/shared/useCarIdxRollingAvgLapTime';
import { validateReplay, type ReplayProbe } from './validator';

// The full local recording is intentionally kept outside the repository.
// $env:IRDASHIES_FUEL_TEST_TAPE='<path to fuel-test.irdt>'
describe.skipIf(!process.env.IRDASHIES_FUEL_TEST_TAPE)(
  'average lap times over fuel-test',
  () => {
    it('checks raw timing updates and pit-road history through the processor, store and averaging hook', async () => {
      const processor = new LapTimesProcessor();
      const tapePath = process.env.IRDASHIES_FUEL_TEST_TAPE;
      if (!tapePath)
        throw new Error('Set IRDASHIES_FUEL_TEST_TAPE to the recording path');
      processor.init({} as Session);
      useLapTimesStore.getState().reset();
      const windows = [1, 3, 10, 20, 100];
      const view = renderHook(() =>
        windows.map((count) => ({
          all: useCarIdxRollingAvgLapTime(count),
          filtered: useCarIdxRollingAvgLapTime(count, true),
        }))
      );
      // Oracle reads current-lap crossings (not the processor's completed-lap
      // counter), accumulates pit-road samples, and observes official time changes.
      let session = -1;
      let previous: {
        lap: number;
        time: number;
        pit: boolean;
        pending: boolean;
        eligible: boolean;
      }[] = [];
      let all: number[][] = [];
      let eligible: number[][] = [];
      let version = -1;
      let checked = 0;
      let observedLaps = 0;
      let excludedLaps = 0;
      let deepestHistory = 0;
      let pitStopChecked = false;
      const probe: ReplayProbe<number> = {
        name: 'average-lap-time-validation',
        schemaVersion: 1,
        variables: [
          'SessionNum',
          'SessionTime',
          'CarIdxLap',
          'CarIdxLapCompleted',
          'CarIdxLastLapTime',
          'CarIdxOnPitRoad',
          'CarIdxTrackSurface',
        ],
        onFrame(raw) {
          const sessionNum = Number(raw.SessionNum);
          if (session !== sessionNum) {
            session = sessionNum;
            previous = [];
            all = [];
            eligible = [];
          }
          const laps = raw.CarIdxLap as readonly number[];
          const times = raw.CarIdxLastLapTime as readonly number[];
          const pits = raw.CarIdxOnPitRoad as readonly number[];
          const surfaces = raw.CarIdxTrackSurface as readonly number[];
          const now = Number(raw.SessionTime);
          for (let idx = 0; idx < times.length; idx++) {
            const lap = laps[idx];
            const time = times[idx];
            const pit =
              !!pits[idx] || surfaces[idx] === 1 || surfaces[idx] === -1;
            const prev = previous[idx];
            if (!prev) {
              previous[idx] = {
                lap,
                time,
                pit: true,
                pending: false,
                eligible: false,
              };
              all[idx] = [];
              eligible[idx] = [];
              continue;
            }
            if (lap !== prev.lap) {
              if (
                prev.pending &&
                lap === prev.lap + 1 &&
                time === prev.time &&
                time > 0
              ) {
                all[idx] = [...all[idx], time].slice(-100);
                if (prev.eligible)
                  eligible[idx] = [...eligible[idx], time].slice(-100);
                observedLaps++;
                if (!prev.eligible) excludedLaps++;
              }
              prev.pending = lap === prev.lap + 1 && prev.lap >= 1;
              prev.eligible = !prev.pit && !pit;
              prev.pit = pit || lap < prev.lap;
            }
            if (prev.pending && time !== prev.time) {
              if (time > 0) {
                all[idx].push(time);
                all[idx] = all[idx].slice(-100);
                observedLaps++;
                if (prev.eligible) {
                  eligible[idx].push(time);
                  eligible[idx] = eligible[idx].slice(-100);
                } else excludedLaps++;
                deepestHistory = Math.max(deepestHistory, all[idx].length);
                if (sessionNum === 2 && idx === 0 && time > 500) {
                  expect(prev.eligible).toBe(false);
                  pitStopChecked = true;
                }
              }
              prev.pending = false;
            }
            prev.pit ||= pit;
            prev.lap = lap;
            prev.time = time;
          }
          const telemetry = Object.fromEntries(
            Object.entries(raw).map(([key, value]) => [
              key,
              { value: Array.isArray(value) ? value : [value] },
            ])
          ) as unknown as Telemetry;
          processor.onFrame(telemetry);
          const snapshot = processor.snapshot();
          if (snapshot.version !== version) {
            expect(snapshot.lapTimeHistory).toEqual(all);
            for (let idx = 0; idx < eligible.length; idx++) {
              expect(
                snapshot.cleanLapTimeHistory?.[idx],
                `session ${sessionNum}, time ${now}, car ${idx}, lap ${laps[idx]}`
              ).toEqual(eligible[idx]);
            }
            act(() => useLapTimesStore.getState().applySnapshot(snapshot));
            for (let w = 0; w < windows.length; w++) {
              for (const [histories, values] of [
                [all, view.result.current[w].all],
                [eligible, view.result.current[w].filtered],
              ] as const) {
                const expected = histories.map((history) => {
                  const recent = history.slice(-windows[w]);
                  return recent.length
                    ? recent.reduce((sum, t) => sum + t, 0) / recent.length
                    : 0;
                });
                expect(values).toEqual(expected);
              }
            }
            version = snapshot.version;
            checked++;
          }
          return snapshot.version;
        },
      };
      try {
        const result = await validateReplay({
          path: tapePath,
          probes: [probe],
        });
        expect(result.metadata.frameCount).toBe(186896);
        expect(deepestHistory).toBeGreaterThan(20);
        expect(observedLaps).toBeGreaterThan(300);
        expect(excludedLaps).toBeGreaterThan(0);
        expect(pitStopChecked).toBe(true);
        process.stdout.write(
          `Average lap replay: ${result.metadata.frameCount} frames, ${observedLaps} timed laps, ${excludedLaps} pit/partial laps excluded, ${checked} snapshots checked at windows ${windows.join(', ')}; maximum history ${deepestHistory}.\n`
        );
      } finally {
        view.unmount();
        useLapTimesStore.getState().reset();
      }
    }, 120_000);
  }
);
