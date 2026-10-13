import { act, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as yaml from 'js-yaml';
import type {
  ChannelBridge,
  FuelProjectionSnapshot,
  Session,
  Telemetry,
} from '@irdashies/types';
import { FuelProjectionProcessor } from '../../src/app/processors/FuelProjectionProcessor';
import { FuelHistory } from '../../src/frontend/components/FuelCalculator/widgets/FuelHistory';
import { useFuelCalculation } from '../../src/frontend/components/FuelCalculator/useFuelCalculation';
import { useFuelStore } from '../../src/frontend/components/FuelCalculator/FuelStore';
import { defaultFuelCalculatorSettings } from '../../src/frontend/components/FuelCalculator/defaults';
import metadata from '../../test-data/telemetry/ai-race-10min.json';
import golden from '../../test-data/telemetry/ai-race-10min.golden.json';
import { validateReplay, type ReplayProbe } from './validator';
import { createFuelStateProbe } from './fuel-probe';

vi.mock('@irdashies/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@irdashies/context')>()),
  useDashboard: () => ({ isDemoMode: false }),
}));

// The Git LFS tape is optional for ordinary unit-test checkouts.
// IRDASHIES_TEST_CURATED_REPLAY=1 npx vitest run tools/telemetry-replay/fuel-history.replay.spec.tsx
const previousBridge = window.channelBridge;
afterEach(() => {
  window.channelBridge = previousBridge;
  useFuelStore.getState().clearAllData();
});

describe.skipIf(process.env.IRDASHIES_TEST_CURATED_REPLAY !== '1')(
  'Fuel history over the curated ten-minute tape',
  () => {
    it('renders raw boundary fuel differences through the processor, channel and store in both units', async () => {
      useFuelStore.getState().clearAllData();
      let clockMilliseconds = 0;
      const processor = new FuelProjectionProcessor({
        clock: () => clockMilliseconds,
        sourceReplay: true,
      });
      const listeners = new Set<(snapshot: FuelProjectionSnapshot) => void>();
      const bridge: ChannelBridge = {
        subscribe(channel, callback) {
          if (channel !== 'fuel.projection') return () => undefined;
          const listener = callback as (
            snapshot: FuelProjectionSnapshot
          ) => void;
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      };
      window.channelBridge = bridge;
      const settings = {
        ...defaultFuelCalculatorSettings,
        fuelHistoryType: 'table' as const,
        enableStorage: false,
        enableLogging: false,
      };
      const Harness = () => {
        useFuelCalculation(0, settings);
        return (
          <>
            <div data-testid="one-litre">
              <FuelHistory
                fuelUnits="L"
                settings={{ ...settings, fuelHistoryLapCount: 1 }}
              />
            </div>
            <div data-testid="eight-litres">
              <FuelHistory
                fuelUnits="L"
                settings={{ ...settings, fuelHistoryLapCount: 8 }}
              />
            </div>
            <div data-testid="three-litres">
              <FuelHistory
                fuelUnits="L"
                settings={{ ...settings, fuelHistoryLapCount: 3 }}
              />
            </div>
            <div data-testid="five-litres">
              <FuelHistory
                fuelUnits="L"
                settings={{ ...settings, fuelHistoryLapCount: 5 }}
              />
            </div>
            <div data-testid="five-gallons">
              <FuelHistory
                fuelUnits="gal"
                settings={{ ...settings, fuelHistoryLapCount: 5 }}
              />
            </div>
          </>
        );
      };
      const view = render(<Harness />);
      let previousLap: number | undefined;
      let lapStartFuel = 0;
      let previousFuel = 0;
      let refuel = 0;
      const measured: { lapNumber: number; fuelUsed: number }[] = [];
      let emissions = 0;
      let lastEmittedAt = -Infinity;
      let lastEmittedLapCount = 0;
      const checkRows = () => {
        for (const [id, count, factor, unit] of [
          ['one-litre', 1, 1, 'L'],
          ['eight-litres', 8, 1, 'L'],
          ['three-litres', 3, 1, 'L'],
          ['five-litres', 5, 1, 'L'],
          ['five-gallons', 5, 0.264172, 'gal'],
        ] as const) {
          const container = within(view.getByTestId(id));
          const table = container.getByRole('table');
          const expected = measured
            .slice(-count)
            .reverse()
            .map((lap) => [
              String(lap.lapNumber),
              `${(lap.fuelUsed * factor).toFixed(2)} ${unit}`,
            ]);
          if (expected.length === 0) {
            expect(
              container.getByText('Waiting for a completed lap')
            ).toBeInTheDocument();
          } else {
            const actual = within(table)
              .getAllByRole('row')
              .slice(1)
              .map((row) =>
                within(row)
                  .getAllByRole('cell')
                  .map((cell) => cell.textContent)
              );
            expect(actual).toEqual(expected);
          }
        }
      };
      const probe: ReplayProbe<{ lapCount: number }> = {
        name: 'fuel-history-render',
        schemaVersion: 1,
        variables: [
          'FuelLevel',
          'FuelLevelPct',
          'IsOnTrack',
          'Lap',
          'LapDistPct',
          'OnPitRoad',
          'PlayerCarTowTime',
          'SessionFlags',
          'SessionNum',
          'SessionTime',
          'SessionLapsRemain',
          'SessionTimeRemain',
          'SessionTimeTotal',
          'SessionState',
        ],
        onSessionInfo(text) {
          processor.init(yaml.load(text, { json: true }) as Session);
        },
        onFrame(frame, context) {
          clockMilliseconds = Math.round(context.elapsedSeconds * 1000);
          const currentLap = Number(frame.Lap);
          const fuel = Number(frame.FuelLevel);
          // Independently measure fuel loss between raw Lap increments; no engine state or formatting helper is used.
          if (previousLap === undefined) {
            lapStartFuel = fuel;
          } else if (currentLap > previousLap) {
            if (previousLap >= 1 && currentLap === previousLap + 1) {
              expect(refuel).toBe(0); // This tape has no refuelling on its three completed laps.
              measured.push({
                lapNumber: previousLap,
                fuelUsed: lapStartFuel - fuel,
              });
            }
            lapStartFuel = fuel;
            refuel = 0;
          } else if (fuel - previousFuel > 0.05) {
            refuel += fuel - previousFuel;
          }
          previousLap = currentLap;
          previousFuel = fuel;
          const telemetry = Object.fromEntries(
            Object.entries(frame).map(([key, value]) => [
              key,
              { value: [value] },
            ])
          ) as unknown as Telemetry;
          processor.onFrame(telemetry);
          const snapshot = processor.snapshot();
          // Deliver at the production 5 Hz cadence, plus every completed-lap change.
          if (
            context.elapsedSeconds - lastEmittedAt >= 0.2 ||
            snapshot.completedLaps.length !== lastEmittedLapCount
          ) {
            act(() => {
              for (const listener of listeners) listener(snapshot);
            });
            lastEmittedAt = context.elapsedSeconds;
            lastEmittedLapCount = snapshot.completedLaps.length;
            emissions++;
            checkRows();
          }
          return { lapCount: snapshot.completedLaps.length };
        },
      };
      try {
        const result = await validateReplay({
          path: 'test-data/telemetry/ai-race-10min.irdt',
          expected: {
            sha256: metadata.sha256,
            frameCount: metadata.frameCount,
            sessionUpdateCount: metadata.sessionUpdateCount,
          },
          probes: [probe, createFuelStateProbe()],
        });
        expect(result.metadata.frameCount).toBe(36000);
        expect(result.metadata.sessionUpdateCount).toBe(70);
        expect(measured.map((lap) => lap.lapNumber)).toEqual([1, 2, 3]);
        // Compare independent raw-boundary measurements with the reviewed fuel golden as well.
        const fuelGolden = golden.probes.find(
          (entry) => entry.name === 'fuel-state'
        );
        expect(fuelGolden).toBeDefined();
        expect(
          result.probes.find((entry) => entry.name === 'fuel-state')
            ?.rollingHash
        ).toBe(fuelGolden?.rollingHash);
        for (const lap of measured) {
          const checkpoint = fuelGolden?.checkpoints[
            `lap:${lap.lapNumber}` as keyof typeof fuelGolden.checkpoints
          ] as unknown as { commands: { lap: { fuelUsed: number } }[] };
          expect(lap.fuelUsed).toBeCloseTo(
            checkpoint.commands[0].lap.fuelUsed,
            10
          );
        }
        checkRows();
        process.stdout.write(
          `Fuel history replay: ${result.metadata.frameCount} frames, ${result.metadata.sessionUpdateCount} session revisions, ${emissions} channel deliveries; laps ${measured.map((lap) => `${lap.lapNumber}=${lap.fuelUsed.toFixed(2)} L`).join(', ')}.\n`
        );
        act(() => {
          processor.onLifecycle({ type: 'disconnect' });
          useFuelStore.getState().clearAllData();
          for (const listener of listeners) listener(processor.snapshot());
        });
        expect(view.getAllByText('Waiting for a completed lap')).toHaveLength(
          5
        );
      } finally {
        view.unmount();
      }
    }, 120_000);
  }
);
