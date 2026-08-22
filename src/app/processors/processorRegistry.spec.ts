import { describe, expect, it } from 'vitest';
import { channelRegistry } from '@irdashies/types';
import { createProcessorDefinitions } from './processorRegistry';

/**
 * Snapshot channels owned by a standalone runtime instead of the host.
 * LapHistoryRuntime records lap crossings outside demand gating so an enabled
 * Gantry keeps recording with its window closed; registering it here as well
 * would run a second processor and publish a competing snapshot.
 */
const RUNTIME_OWNED_CHANNELS = ['lap-history.snapshot'];

describe('processor registry', () => {
  it('registers every host-owned snapshot channel exactly once', () => {
    const definitions = createProcessorDefinitions({
      referenceLapPersistence: {
        load: () => null,
        save: () => undefined,
      },
    });
    const snapshotChannels = Object.entries(channelRegistry)
      .filter(([, channel]) => channel.kind === 'snapshot')
      .map(([channel]) => channel)
      .filter((channel) => !RUNTIME_OWNED_CHANNELS.includes(channel))
      .sort();

    expect(definitions.map(({ channel }) => channel).sort()).toEqual(
      snapshotChannels
    );
    expect(new Set(definitions.map(({ channel }) => channel)).size).toBe(
      definitions.length
    );
  });

  it('leaves runtime-owned channels out of the host registry', () => {
    const definitions = createProcessorDefinitions({
      referenceLapPersistence: {
        load: () => null,
        save: () => undefined,
      },
    });
    const channels = definitions.map(({ channel }) => channel);

    for (const runtimeOwned of RUNTIME_OWNED_CHANNELS) {
      expect(channels).not.toContain(runtimeOwned);
    }
  });

  it('declares the processor dependency graph explicitly', () => {
    const definitions = createProcessorDefinitions({
      referenceLapPersistence: {
        load: () => null,
        save: () => undefined,
      },
    });
    const dependencies = Object.fromEntries(
      definitions.map(({ channel, dependencies: required = [] }) => [
        channel,
        required,
      ])
    );

    expect(dependencies['relative-gaps.snapshot']).toEqual([
      'reference-laps.snapshot',
    ]);
    expect(dependencies['session-timing.snapshot']).toEqual([
      'lap-times.snapshot',
    ]);
  });
});
