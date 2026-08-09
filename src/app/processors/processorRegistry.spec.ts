import { describe, expect, it } from 'vitest';
import { channelRegistry } from '@irdashies/types';
import { createProcessorDefinitions } from './processorRegistry';

describe('processor registry', () => {
  it('registers every snapshot channel exactly once', () => {
    const definitions = createProcessorDefinitions({
      referenceLapPersistence: {
        load: () => null,
        save: () => undefined,
      },
    });
    const snapshotChannels = Object.entries(channelRegistry)
      .filter(([, channel]) => channel.kind === 'snapshot')
      .map(([channel]) => channel)
      .sort();

    expect(definitions.map(({ channel }) => channel).sort()).toEqual(
      snapshotChannels
    );
    expect(new Set(definitions.map(({ channel }) => channel)).size).toBe(
      definitions.length
    );
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
