/**
 * Which of the reference lap's brake applications are worth cueing.
 *
 * `LapTraceEvents.brakeOnM` records EVERY brake application, filtered only by
 * MIN_EVENT_SPACING_M (5 m) chatter suppression. Counting a driver down to a
 * stabilising dab in a fast kink would make the feature something people switch
 * off. So the raw array is filtered once per reference lap.
 *
 * Proximity is not part of that filter. There used to be a rule that merged a
 * re-application within 40 m of a release into the zone before it, to keep a
 * chicane from beeping twice. It cost more than it bought: the two halves of a
 * chicane are two corners, each with its own brake point to mark and compare,
 * and merging them left the second half with nothing (Imola's Variante
 * Villeneuve). An application only exists at all where the pedal genuinely
 * cycled — BRAKE_RELEASE_FRACTION decides that — so a momentary wobble inside
 * one zone never reaches this filter, and what does reach it is judged on its
 * own merits. Two zones close together are cued as two; the countdown handles
 * the crowding, not this list (see brakeCueLatch.ts).
 *
 * Two criteria, both recovered from the lap's own samples — the events array
 * carries no intensity, so a 5% brush and a 100% stop are indistinguishable in
 * it, but `samples.brake` and `samples.speed` are right there.
 *
 * **Peak pedal pressure** is the primary discriminator. Speed scrubbed alone was
 * tried first and cannot separate the two ends of the problem: corners can sit
 * under 200 m apart and a real corner brake point may only take 2-3 m/s off
 * (Okayama's Revolver), while a stabilising brush inside a fast corner can be
 * mistaken for one. Measured over four Garage 61 laps, pressure separates them
 * cleanly — genuine corner brake points peaked at 16-19% while the brushes
 * peaked under 12%. Pressure is car-dependent (brake bias, pedal travel, and
 * some cars log force rather than travel), which is why it is a user setting
 * rather than a constant; 10-15% behaved identically across those laps, so the
 * default sits on a plateau rather than a knife edge.
 *
 * **Speed scrubbed** stays on as a floor, with a narrower job than it used to
 * have: rejecting the hard stab that does not actually slow the car.
 */

import type { LapTraceSamples, LapTraceView } from '@irdashies/types';
import { maxOver, minOver, valueAtDistance } from './lapSamples';
import { nextEventIndex, signedLapDelta } from './pedalEvents';

/**
 * Speed a brake application must scrub to earn a countdown, in m/s (~7 km/h).
 * Not "is this a braking zone" — peak pressure answers that — but "did this
 * actually slow the car", which rejects a stab that scrubs nothing.
 */
export const BRAKE_CUE_MIN_SPEED_DROP_MS = 2.0;

/**
 * Peak brake pressure (0-1) a reference application must reach to earn a
 * countdown, when the caller does not supply the user's setting.
 */
export const BRAKE_CUE_MIN_PEAK_DEFAULT = 0.12;

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
 * Highest brake pressure over `lengthM` of track starting at `fromM`, the mirror
 * of `minSpeedOver`, or -1 if unknown.
 */
function peakBrakeOver(
  samples: LapTraceSamples,
  fromM: number,
  lengthM: number,
  trackLengthM: number
): number {
  const firstM = samples.distanceM[0];
  const lastM = samples.distanceM[samples.length - 1];
  const toM = fromM + lengthM;

  let max = maxOver(samples, samples.brake, fromM, Math.min(toM, lastM));
  if (toM > trackLengthM) {
    const wrapped = maxOver(
      samples,
      samples.brake,
      firstM,
      Math.min(toM - trackLengthM, lastM)
    );
    if (!(max >= wrapped)) max = wrapped;
  }
  return Number.isFinite(max) ? max : -1;
}

export interface BrakeCuePointOptions {
  /**
   * Peak brake pressure (0-1) an application must reach. Defaults to
   * BRAKE_CUE_MIN_PEAK_DEFAULT. Every consumer of this list must pass the same
   * value: if the countdown and the brake-distance delta disagree on what a
   * braking zone is, one of them goes silent while the other does not.
   */
  minPeak?: number;
}

/**
 * The reference lap's brake points worth counting down to, ascending, in metres
 * at full sub-metre precision.
 *
 * Empty when the lap carries no usable events or samples, in which case the
 * countdown is silently unavailable, exactly as the brake/throttle markers
 * already behave.
 */
export function selectBrakeCuePoints(
  lap: LapTraceView,
  options?: BrakeCuePointOptions
): Float32Array {
  const minPeak = options?.minPeak;
  const minPeakBrake =
    typeof minPeak === 'number' && minPeak >= 0
      ? minPeak
      : BRAKE_CUE_MIN_PEAK_DEFAULT;
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
    // if the driver pressed hard enough AND real speed came off.
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

    const peakBrake = peakBrakeOver(samples, pointM, zoneLengthM, trackLengthM);
    if (peakBrake < minPeakBrake) continue;

    const entrySpeed = valueAtDistance(samples, samples.speed, pointM);
    const minSpeed = minSpeedOver(samples, pointM, zoneLengthM, trackLengthM);
    if (!(entrySpeed > 0) || minSpeed < 0) continue;
    if (entrySpeed - minSpeed < BRAKE_CUE_MIN_SPEED_DROP_MS) continue;

    kept[keptCount++] = pointM;
  }

  return keptCount === brakeOnM.length ? kept : kept.slice(0, keptCount);
}
