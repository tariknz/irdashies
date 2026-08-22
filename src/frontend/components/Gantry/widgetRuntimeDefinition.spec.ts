import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import definition from './widgetRuntimeDefinition';

const GANTRY_DIR = join(__dirname);
const RELATED_FILES = [
  join(__dirname, '../../context/RaceControlStore'),
  join(__dirname, '../Settings/sections/GantrySettings.tsx'),
];

/** The legacy renderer telemetry API. None of it may reach Gantry again. */
const LEGACY_TELEMETRY_API = [
  'useTelemetryValues',
  'useTelemetryValue',
  'useTelemetry',
  'useTelemetryStore',
  'TelemetryProvider',
];

const collectSourceFiles = (target: string): string[] => {
  if (statSync(target).isFile()) return [target];
  return readdirSync(target).flatMap((entry) => {
    const full = join(target, entry);
    if (statSync(full).isDirectory()) return collectSourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
};

describe('Gantry widget runtime definition', () => {
  it('declares the typed channels Gantry consumes', () => {
    expect(definition.id).toBe('gantry');
    expect(definition.channels).toEqual(
      expect.arrayContaining([
        'lap-times.snapshot',
        'standings.snapshot',
        'track-state.snapshot',
      ])
    );
  });

  it('keeps session data, which is not raw telemetry', () => {
    expect(definition.sessionData).toBe(true);
  });

  it('requests standings at the sortable 5 Hz preset', () => {
    expect(definition.ratePreset).toBe('gapTiming');
  });

  it('does not poll track state faster than Gantry needs', () => {
    const standingsRate = 5;
    expect(definition.channelRates['track-state.snapshot']).toBeLessThanOrEqual(
      standingsRate
    );
  });

  it('declares no raw-telemetry channel of its own', () => {
    const channels: readonly string[] = definition.channels;
    expect(channels.some((channel) => channel.includes('telemetry'))).toBe(
      false
    );
  });
});

describe('Gantry legacy telemetry migration', () => {
  const files = [
    ...collectSourceFiles(GANTRY_DIR),
    ...RELATED_FILES.flatMap(collectSourceFiles),
  ].filter((file) => !file.endsWith('widgetRuntimeDefinition.spec.ts'));

  it('reads no legacy renderer telemetry anywhere in Gantry', () => {
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return LEGACY_TELEMETRY_API.filter((api) =>
        new RegExp(`\\b${api}\\b`).test(source)
      ).map((api) => `${file}: ${api}`);
    });

    expect(offenders).toEqual([]);
  });
});
