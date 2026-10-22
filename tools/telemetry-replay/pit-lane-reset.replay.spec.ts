import { afterEach, describe, expect, it } from 'vitest';
import {
  detectPitTransitions,
  usePitLaneStore,
} from '../../src/frontend/context/PitLaneStore/PitLaneStore';
import metadata from '../../test-data/telemetry/ai-race-10min.json';
import { validateReplay, type ReplayProbe } from './validator';

// Optional 332 MB Git LFS capture. No pit exit occurs in this tape; ordinary
// provider/store fixtures cover exit relearning and cross-window reset delivery.
// IRDASHIES_TEST_CURATED_REPLAY=1 npx vitest run --no-coverage tools/telemetry-replay/pit-lane-reset.replay.spec.ts
describe.skipIf(process.env.IRDASHIES_TEST_CURATED_REPLAY !== '1')(
  'pit calibration reset with curated telemetry',
  () => {
    afterEach(() => usePitLaneStore.getState().reset());

    it('relearns the recorded entry after clearing an existing calibration', async () => {
      const store = usePitLaneStore;
      store
        .getState()
        .setCurrentTrack('18', { pitEntryPct: 0.5, pitExitPct: 0.6 }, 0);
      let reset = false;
      let observedEntry = false;
      const probe: ReplayProbe<number | null> = {
        name: 'pit-entry-reset',
        schemaVersion: 1,
        variables: [
          'SessionTime',
          'CarIdxOnPitRoad',
          'CarIdxTrackSurface',
          'CarIdxLapDistPct',
        ],
        onFrame(frame) {
          const pits = (frame.CarIdxOnPitRoad as readonly number[]).map(
            Boolean
          );
          const surfaces = frame.CarIdxTrackSurface as readonly number[];
          const positions = frame.CarIdxLapDistPct as readonly number[];

          // The recorded entry is at 151.600 s. Clear during the preceding
          // second, letting the detector seed from fresh post-reset frames.
          if (!reset && Number(frame.SessionTime) >= 151) {
            store.getState().setCurrentTrack('18', null, 1);
            expect(store.getState().pitEntryPct).toBeNull();
            expect(store.getState().pitExitPct).toBeNull();
            expect(store.getState().calibrationRevision).toBe(1);
            reset = true;
          }
          detectPitTransitions(pits, surfaces, positions);

          if (reset && store.getState().pitEntryPct !== null) {
            expect(store.getState().pitEntryPct).toBeCloseTo(
              0.9599710702896118,
              8
            );
            // This capture contains no pit exit.
            expect(store.getState().pitExitPct).toBeNull();
            observedEntry = true;
          }
          return store.getState().pitEntryPct;
        },
      };

      const result = await validateReplay({
        path: 'test-data/telemetry/ai-race-10min.irdt',
        expected: { sha256: metadata.sha256, frameCount: metadata.frameCount },
        probes: [probe],
      });
      expect(result.metadata.frameCount).toBe(36000);
      expect(reset).toBe(true);
      expect(observedEntry).toBe(true);
    }, 120_000);
  }
);
