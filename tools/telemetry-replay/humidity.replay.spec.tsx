import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import * as yaml from 'js-yaml';
import type {
  ChannelBridge,
  Session,
  SessionBarSnapshot,
  Telemetry,
} from '@irdashies/types';
import { SessionBarProcessor } from '../../src/app/processors/SessionBarProcessor';
import { HumidityItem } from '../../src/frontend/components/Standings/components/SessionBar/components/HumidityItem/HumidityItem';
import metadata from '../../test-data/telemetry/ai-race-10min.json';
import { validateReplay, type ReplayProbe } from './validator';

const previousBridge = window.channelBridge;
afterEach(() => {
  window.channelBridge = previousBridge;
});

// The curated tape is a 332 MB Git LFS download, optional for ordinary unit tests.
// IRDASHIES_TEST_CURATED_REPLAY=1 npx vitest run tools/telemetry-replay/humidity.replay.spec.tsx
// This checks the recorded SDK fraction through the processor, channel, and rendered item.
describe.skipIf(process.env.IRDASHIES_TEST_CURATED_REPLAY !== '1')(
  'curated humidity replay',
  () => {
    it('shows the tape humidity percentage and resets on disconnect', async () => {
      const processor = new SessionBarProcessor();
      const listeners = new Set<(snapshot: SessionBarSnapshot) => void>();
      const bridge: ChannelBridge = {
        subscribe(channel, callback) {
          if (channel !== 'session-bar.snapshot') return () => undefined;
          const listener = callback as (snapshot: SessionBarSnapshot) => void;
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      };
      window.channelBridge = bridge;
      const emit = () => {
        for (const listener of listeners) listener(processor.snapshot());
      };
      const view = render(<HumidityItem settings={undefined} standalone />);
      const percentages = new Set<number>();
      let previousFraction: number | undefined;
      let renderedChecks = 0;
      const probe: ReplayProbe<number | undefined> = {
        name: 'humidity-render',
        schemaVersion: 1,
        variables: ['SessionTime', 'SessionNum', 'RelativeHumidity'],
        onSessionInfo(text) {
          processor.init(yaml.load(text, { json: true }) as Session);
        },
        onFrame(frame) {
          const telemetry = Object.fromEntries(
            Object.entries(frame).map(([key, value]) => [
              key,
              { value: [value] },
            ])
          ) as unknown as Telemetry;
          processor.onFrame(telemetry);
          const humidity = Number(frame.RelativeHumidity);
          // The processor samples at 5 Hz; humidity in this tape changes slowly.
          const sampledHumidity = processor.snapshot().relativeHumidity;
          expect(sampledHumidity).toBeCloseTo(humidity, 3);
          if (sampledHumidity !== previousFraction || renderedChecks === 0) {
            act(emit);
            expect(view.container.textContent).toBe(
              `${Math.round(humidity * 100)}%`
            );
            percentages.add(Math.round(humidity * 100));
            previousFraction = sampledHumidity;
            renderedChecks++;
          }
          return sampledHumidity;
        },
        onDisconnect() {
          act(() => {
            processor.onLifecycle({ type: 'disconnect' });
            emit();
          });
          expect(view.container.textContent).toBe('- %');
        },
      };
      try {
        const result = await validateReplay({
          path: 'test-data/telemetry/ai-race-10min.irdt',
          expected: {
            sha256: metadata.sha256,
            frameCount: metadata.frameCount,
          },
          probes: [probe],
        });
        expect(result.metadata.frameCount).toBe(36000);
        expect(renderedChecks).toBeGreaterThan(0);
        // The capture has no disconnect record; explicitly end the session to
        // check that a previously displayed humidity does not survive disconnect.
        act(() => {
          processor.onLifecycle({ type: 'disconnect' });
          emit();
        });
        expect(view.container.textContent).toBe('- %');
        process.stdout.write(
          `Humidity replay: ${result.metadata.frameCount} frames; displayed ${[...percentages].join(', ')}%; ${renderedChecks} rendered checks; disconnect cleared value.\n`
        );
      } finally {
        view.unmount();
      }
    }, 120_000);
  }
);
