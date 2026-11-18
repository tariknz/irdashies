import { parseSession, telemetryFrom } from './processorInputs';
import { resolve } from 'node:path';
import { stat } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { ChannelBus } from '../../src/app/bridge/channelBridge';
import { createSessionLifecycle } from '../../src/app/sessionLifecycle';
import { LapHistoryRuntime } from '../../src/app/processors/lapHistoryRuntime';
import { RelativeGapProcessor } from '../../src/app/processors/RelativeGapProcessor';
import { lastLineGap } from '../../src/frontend/domain/lapHistory/lapSeries';
import { validateReplay, type ReplayProbe } from './validator';
import metadata from '../../test-data/telemetry/ai-race-10min.json';

const tapePath = resolve('test-data/telemetry/ai-race-10min.irdt');
const tapeAvailable = await stat(tapePath).then(
  (file) => file.size === metadata.fileBytes,
  () => false
);

describe.skipIf(!tapeAvailable)('Battle gaps over the curated tape', () => {
  it.each([1, 10])(
    'has a previous gap and changing delta at %sx',
    async (speed) => {
      const lifecycle = createSessionLifecycle();
      const persistence = {
        load: vi.fn(async () => null),
        save: vi.fn(),
        seal: vi.fn(),
      };
      const runtime = new LapHistoryRuntime(
        new ChannelBus(),
        lifecycle,
        { markStart: () => undefined, markEnd: () => undefined },
        persistence
      );
      const relatives = new RelativeGapProcessor({
        snapshot: () => ({
          bestLaps: [],
          persistedLaps: [],
          sessionNum: null,
          version: 0,
        }),
      });
      let lastSample = -Infinity;
      let comparisons = 0;
      let gaining = 0;
      let losing = 0;
      lifecycle._onEnter({ replay: true });
      const probe: ReplayProbe<number> = {
        name: 'battle-gap',
        schemaVersion: 1,
        variables: [
          'SessionNum',
          'SessionTime',
          'CamCarIdx',
          'CarIdxLap',
          'CarIdxLapDistPct',
          'CarIdxEstTime',
          'CarIdxClassPosition',
          'CarIdxOnPitRoad',
          'CarIdxTrackSurface',
        ],
        onSessionInfo(text) {
          const session = parseSession(text);
          runtime.onSession(session);
          relatives.init(session);
        },
        onFrame(raw, context) {
          if (context.elapsedSeconds - lastSample < speed / 25)
            return comparisons;
          lastSample = context.elapsedSeconds;
          const telemetry = telemetryFrom(raw);
          lifecycle._onTelemetry(telemetry);
          runtime.onFrame(telemetry);
          relatives.onFrame(telemetry);
          const { focusCarIdx, deltas } = relatives.snapshot();
          if (focusCarIdx === null) return comparisons;
          for (let carIdx = 0; carIdx < deltas.length; carIdx++) {
            const liveGap = deltas[carIdx];
            if (carIdx === focusCarIdx || liveGap == null) continue;
            const previousGap =
              liveGap >= 0
                ? lastLineGap(runtime.snapshot(), focusCarIdx, carIdx)
                : lastLineGap(runtime.snapshot(), carIdx, focusCarIdx);
            if (previousGap === null) continue;
            const delta = Math.abs(liveGap) - previousGap;
            if (delta < -0.005) gaining++;
            if (delta > 0.005) losing++;
            comparisons++;
          }
          return comparisons;
        },
        onDisconnect() {
          lifecycle._onDisconnect();
          lifecycle._onEnter({ replay: true });
        },
      };
      try {
        await validateReplay({
          path: tapePath,
          sessionPollMilliseconds: 500 * speed,
          probes: [probe],
        });
        expect(comparisons).toBeGreaterThan(100);
        expect(gaining).toBeGreaterThan(0);
        expect(losing).toBeGreaterThan(0);
        lifecycle._onDisconnect();
        expect(runtime.snapshot().count.every((count) => count === 0)).toBe(
          true
        );
        expect(persistence.load).not.toHaveBeenCalled();
        expect(persistence.save).not.toHaveBeenCalled();
        expect(persistence.seal).not.toHaveBeenCalled();
      } finally {
        runtime.dispose();
      }
    },
    120_000
  );
});
