import type { LapTraceRecord, LapTraceView } from '@irdashies/types';
import { deriveEvents } from './pedalEvents';
import { selectThrottlePoints } from './throttlePoints';

/**
 * Derives everything the renderer needs from a persisted lap record.
 *
 * None of this is persisted, deliberately: an importer (.ibt, Garage 61) only
 * has to produce samples and hydration handles the rest — including the pedal
 * application points, so a threshold change applies to every stored lap.
 */

/** Cap on gear-change entries. A lap with more shifts than this is truncated. */
const MAX_GEAR_CHANGES = 512;

export function hydrateLapTrace(record: LapTraceRecord): LapTraceView {
  const { samples } = record;
  const { speed, gear, distanceM } = samples;
  const n = samples.length;

  let speedMinMs = Number.POSITIVE_INFINITY;
  let speedMaxMs = Number.NEGATIVE_INFINITY;

  const changeM: number[] = [];
  const changeValues: number[] = [];
  let lastGear: number | null = null;

  for (let i = 0; i < n; i++) {
    const v = speed[i];
    if (v < speedMinMs) speedMinMs = v;
    if (v > speedMaxMs) speedMaxMs = v;

    const g = Math.round(gear[i]);
    // Neutral is what the sim reports for the instant between two gears, so
    // labelling it would put an "N" at every shift. Skipping it also means
    // the first sample after a shift seeds the new gear at the right spot.
    if (g === 0) continue;
    // The first geared sample seeds lastGear without emitting a change, so a
    // constant-gear lap produces no labels at all.
    if (lastGear !== null && g !== lastGear) {
      if (changeM.length < MAX_GEAR_CHANGES) {
        changeM.push(distanceM[i]);
        changeValues.push(g);
      }
    }
    lastGear = g;
  }

  if (!Number.isFinite(speedMinMs) || !Number.isFinite(speedMaxMs)) {
    speedMinMs = 0;
    speedMaxMs = 0;
  }

  const events = deriveEvents(samples);

  return {
    ...record,
    speedMinMs,
    speedMaxMs,
    events,
    throttlePointsM: selectThrottlePoints(samples, events.throttleOnM),
    gearChangeM: Float32Array.from(changeM),
    gearChangeValues: Int8Array.from(changeValues),
  };
}
