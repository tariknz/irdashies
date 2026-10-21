import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import * as yaml from 'js-yaml';
import type {
  ChannelBridge,
  DriverControlsSnapshot,
  Session,
  ShiftPointSettings,
  Telemetry,
} from '@irdashies/types';
import { useSessionStore } from '@irdashies/context';
import { loadCarData } from '@irdashies/utils/carData';
import { DriverControlsProcessor } from '../../src/app/processors/DriverControlsProcessor';
import { useTachometerData } from '../../src/frontend/components/ShiftLight/hooks/useTachometerData';
import { ShiftLight } from '../../src/frontend/components/ShiftLight/ShiftLightComponent/ShiftLightComponent';
import metadata from '../../test-data/telemetry/ai-race-10min.json';
import { validateReplay, type ReplayProbe } from './validator';

// The 332 MB Git LFS tape is optional in ordinary unit-test checkouts.
// Run explicitly with IRDASHIES_TEST_CURATED_REPLAY=1 npx vitest run tools/telemetry-replay/shift-light.replay.spec.tsx
const previousBridge = window.channelBridge;
afterEach(() => {
  window.channelBridge = previousBridge;
  useSessionStore.getState().resetSession();
});

describe.skipIf(process.env.IRDASHIES_TEST_CURATED_REPLAY !== '1')(
  'ShiftLight over the complete ten-minute tape',
  () => {
    it('renders channel RPM and per-gear cues for every frame, then resets on disconnect', async () => {
      const processor = new DriverControlsProcessor();
      const listeners = new Set<(snapshot: DriverControlsSnapshot) => void>();
      const bridge: ChannelBridge = {
        subscribe(channel, callback) {
          if (channel !== 'driver-controls.snapshot') return () => undefined;
          const listener = callback as (
            snapshot: DriverControlsSnapshot
          ) => void;
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      };
      window.channelBridge = bridge;
      const emit = () => {
        const snapshot = { ...processor.snapshot() };
        for (const listener of listeners) listener(snapshot);
      };
      let settings: ShiftPointSettings = {
        enabled: true,
        indicatorType: 'glow',
        indicatorColor: '#00ff00',
        carConfigs: {},
      };
      const Harness = () => {
        const data = useTachometerData();
        return (
          <>
            <div data-testid="automatic-cue">
              <ShiftLight
                rpm={data.rpm}
                gear={data.gear}
                maxRpm={data.maxRpm}
                shiftRpm={data.shiftRpm}
              />
            </div>
            <div data-testid="custom-cue">
              <ShiftLight
                rpm={data.rpm}
                gear={data.gear}
                maxRpm={data.maxRpm}
                carPath={data.carPath}
                carData={data.carData}
                shiftPointSettings={settings}
              />
            </div>
          </>
        );
      };
      const view = render(<Harness />);
      let automaticShiftFrames = 0;
      let threshold = Number.POSITIVE_INFINITY;
      let redline = 7500;
      let shiftFrames = 0;
      let rpmFrames = 0;
      let transitions = 0;
      let previousShift = false;
      let peakFrame: Telemetry | undefined;
      let peakRpm = 0;
      const probe: ReplayProbe<{ text: string | null }> = {
        name: 'shiftlight-render',
        schemaVersion: 1,
        variables: ['RPM', 'Gear', 'ShiftGrindRPM'],
        onSessionInfo(text) {
          const session = yaml.load(text, { json: true }) as Session;
          const driver = session.DriverInfo?.Drivers?.find(
            (d) => d.CarIdx === session.DriverInfo?.DriverCarIdx
          );
          const carData = driver?.CarPath ? loadCarData(driver.CarPath) : null;
          if (!carData) throw new Error('Tape player has no bundled car data');
          redline = session.DriverInfo?.DriverCarRedLine ?? 7500;
          threshold = session.DriverInfo?.DriverCarSLShiftRPM || redline * 0.9;
          const carId = carData.carId;
          settings = {
            ...settings,
            carConfigs: {
              [carId]: {
                enabled: true,
                carId,
                carName: carData.carName,
                gearCount: 8,
                redlineRpm: redline,
                gearShiftPoints: Object.fromEntries(
                  Array.from({ length: 8 }, (_, i) => [
                    String(i + 1),
                    { shiftRpm: threshold },
                  ])
                ),
              },
            },
          };
          act(() => {
            processor.init(session);
            useSessionStore.getState().setSession(session);
            emit();
          });
        },
        onFrame(frame) {
          const telemetry = Object.fromEntries(
            Object.entries(frame).map(([key, value]) => [
              key,
              { value: [value] },
            ])
          ) as unknown as Telemetry;
          act(() => {
            processor.onFrame(telemetry);
            emit();
          });
          const rpm = Math.max(0, Math.min(Number(frame.RPM), redline));
          const shouldShift = Number(frame.Gear) > 0 && rpm >= threshold;
          const text =
            view.container.querySelector('[data-testid=custom-cue] #rpm-text')
              ?.textContent ?? null;
          expect(text).toBe(
            shouldShift
              ? 'SHIFT'
              : `${Math.round(rpm).toLocaleString('en-US')}RPM`
          );
          const automaticThreshold =
            processor.snapshot().shiftRpm || redline * 0.9;
          const automaticShift =
            Number(frame.Gear) > 0 && Number(frame.RPM) >= automaticThreshold;
          const automaticText = view.container.querySelector(
            '[data-testid=automatic-cue] #rpm-text'
          )?.textContent;
          expect(automaticText).toBe(
            automaticShift
              ? 'SHIFT'
              : `${Math.round(rpm).toLocaleString('en-US')}RPM`
          );
          if (automaticShift) automaticShiftFrames++;
          if (shouldShift) shiftFrames++;
          else rpmFrames++;
          if (shouldShift !== previousShift) transitions++;
          previousShift = shouldShift;
          if (Number(frame.RPM) > peakRpm && Number(frame.Gear) > 0) {
            peakRpm = Number(frame.RPM);
            peakFrame = telemetry;
          }
          return { text };
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
          probes: [probe],
        });
        expect(result.metadata.frameCount).toBe(36000);
        expect(shiftFrames).toBeGreaterThan(0);
        expect(automaticShiftFrames).toBeGreaterThan(0);
        expect(rpmFrames).toBeGreaterThan(0);
        expect(transitions).toBeGreaterThan(10);
        process.stdout.write(
          `ShiftLight replay: ${result.metadata.frameCount} frames, ${shiftFrames} custom SHIFT frames, ${automaticShiftFrames} automatic SHIFT frames, ${rpmFrames} RPM frames, ${transitions} cue transitions.\n`
        );
        if (!peakFrame) throw new Error('Tape has no forward-gear RPM frame');
        const capturedPeakFrame = peakFrame;
        settings = {
          ...settings,
          carConfigs: Object.fromEntries(
            Object.entries(settings.carConfigs).map(([key, config]) => [
              key,
              { ...config, enabled: false },
            ])
          ),
        };
        act(() => {
          processor.onFrame(capturedPeakFrame);
          emit();
        });
        expect(
          view.container.querySelector('[data-testid=custom-cue]')?.textContent
        ).not.toContain('SHIFT');
        act(() => {
          processor.onLifecycle({ type: 'disconnect' });
          useSessionStore.getState().resetSession();
          emit();
        });
        expect(
          view.container.querySelector('[data-testid=custom-cue] #rpm-text')
            ?.textContent
        ).toBe('0RPM');
      } finally {
        view.unmount();
      }
    }, 120_000);
  }
);
