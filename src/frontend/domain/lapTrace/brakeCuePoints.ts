/**
 * Which of the reference lap's brake applications are worth cueing.
 *
 * `LapTraceEvents.brakeOnM` records EVERY brake application, filtered only by
 * MIN_EVENT_SPACING_M (5 m) chatter suppression. Counting a driver down to a
 * stabilising dab in a fast kink would make the feature something people switch
 * off. So the raw array is filtered once per reference lap.
 *
 * Speed scrubbed is the only filter. There used to be a second one that merged
 * a re-application within 40 m of a release into the zone before it, to keep a
 * chicane from beeping twice. It cost more than it bought: the two halves of a
 * chicane are two corners, each with its own brake point to mark and compare,
 * and merging them left the second half with nothing (Imola's Variante
 * Villeneuve). An application only exists at all where the pedal genuinely
 * cycled — BRAKE_RELEASE_FRACTION decides that — so a momentary wobble inside
 * one zone never reaches this filter, and what does reach it is judged on
 * whether it slowed the car. Two zones close together are cued as two; the
 * countdown handles the crowding, not this list (see brakeCueLatch.ts).
 *
 * The events array itself carries no intensity — a 5% brush and a 100% stop are
 * indistinguishable in it. But the lap's speed samples are right there, so how
 * much speed an application actually scrubbed IS recoverable, and that is a
 * better criterion than pedal pressure would have been: it is car-agnostic (no
 * brake-bias or pedal-travel dependence), it keeps a long gentle trail-brake
 * that still scrubs real speed, and it drops a dab that does not.
 */

import type { LapTraceSamples, LapTraceView } from '@irdashies/types';
import { minOver, valueAtDistance } from './lapSamples';
import { nextEventIndex, signedLapDelta } from './pedalEvents';

/**
 * Speed a brake application must scrub to earn a countdown, in m/s (~20 km/h).
 * Below this it is a stabilising dab, not a braking zone.
 */
export const BRAKE_CUE_MIN_SPEED_DROP_MS = 5.5;

/** Longest stretch searched for the end of one braking zone. */
export const BRAKE_CUE_ZONE_SEARCH_M = 400;

const EMPTY = new Float32Array(0);

/**
 * Lowest speed over `lengthM` of track starting at `fromM`, wrapping past the
 * line if the zone does, or -1 if unknown. Clamped to what the lap actually
 * recorded: a stored lap ends a sample short of the line.
 */
function minSpeedOver(
  samples: LapTraceSamples,
  fromM: number,
  lengthM: number,
  trackLengthM: number
): number {
  const firstM = samples.distanceM[0];
  const lastM = samples.distanceM[samples.length - 1];
  const toM = fromM + lengthM;

  let min = minOver(samples, samples.speed, fromM, Math.min(toM, lastM));
  if (toM > trackLengthM) {
    const wrapped = minOver(
      samples,
      samples.speed,
      firstM,
      Math.min(toM - trackLengthM, lastM)
    );
    if (!(min <= wrapped)) min = wrapped;
  }
  return Number.isFinite(min) ? min : -1;
}

/**
 * The reference lap's brake points worth counting down to, ascending, in metres
 * at full sub-metre precision.
 *
 * Empty when the lap carries no usable events or samples, in which case the
 * countdown is silently unavailable, exactly as the brake/throttle markers
 * already behave.
 */
export function selectBrakeCuePoints(lap: LapTraceView): Float32Array {
  const events = lap.events;
  const trackLengthM = lap.trackLengthM;
  const samples = lap.samples;
  if (!events || !(trackLengthM > 0) || !samples || samples.length < 2) {
    return EMPTY;
  }

  const brakeOnM = events.brakeOnM;
  const brakeOffM = events.brakeOffM;
  if (!brakeOnM || brakeOnM.length === 0) return EMPTY;

  const offCount = brakeOffM?.length ?? 0;
  const kept = new Float32Array(brakeOnM.length);
  let keptCount = 0;

  for (const pointM of brakeOnM) {
    // Significance. Scan from the application to the release that closes it
    // (or a generous fixed window when there is none) and keep the point only
    // if real speed came off.
    const offIdx =
      offCount > 0
        ? nextEventIndex(
            brakeOffM,
            offCount,
            pointM,
            trackLengthM,
            BRAKE_CUE_ZONE_SEARCH_M
          )
        : -1;
    const zoneLengthM =
      offIdx >= 0
        ? signedLapDelta(pointM, brakeOffM[offIdx], trackLengthM)
        : BRAKE_CUE_ZONE_SEARCH_M;

    const entrySpeed = valueAtDistance(samples, samples.speed, pointM);
    const minSpeed = minSpeedOver(samples, pointM, zoneLengthM, trackLengthM);
    if (!(entrySpeed > 0) || minSpeed < 0) continue;
    if (entrySpeed - minSpeed < BRAKE_CUE_MIN_SPEED_DROP_MS) continue;

    kept[keptCount++] = pointM;
  }

  return keptCount === brakeOnM.length ? kept : kept.slice(0, keptCount);
}
