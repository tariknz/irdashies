/**
 * Which brake point belongs to which corner, and how far the driver's own
 * application sat from it — using the interpolated sub-metre application
 * points pedalEvents.ts records (see that file's doc comment for why the
 * crossing is interpolated rather than read off the bucket grid).
 *
 * A brake point usually sits before the corner it belongs to, so attribution
 * searches backward from each corner's start. A split corner can also begin
 * braking after its own start, so a corner that found nothing behind it then
 * takes the earliest point in its own first half — see
 * firstPointInOwnershipInterval for why the half is what makes that safe.
 * Attribution is **exclusive**: corners are processed in track order and each
 * brake point can be claimed only once.
 *
 * Exclusivity is also what makes a generous search distance safe: a long
 * braking zone from top speed can begin 250 m out, well beyond the reach a
 * non-exclusive per-corner window could afford.
 */

import { nextEventIndex, signedLapDelta } from './pedalEvents';

export interface CornerBrakePointAssignment {
  /** Corner starts as lap fractions, in track order. */
  cornerStartPcts: readonly number[];
  /** Corner ends, parallel to `cornerStartPcts`. */
  cornerEndPcts: readonly number[];
  /** Reference brake-on points, in metres — already filtered (brakeCuePoints.ts). */
  brakePointsM: Float32Array;
  /** Where each application ended; retained for compatibility with callers. */
  brakeReleasesM: Float32Array;
  trackLengthM: number;
  /** How far behind a corner's start its brake point may sit. */
  maxLeadM: number;
}

/**
 * The reference brake point for each corner, in metres, parallel to
 * `cornerStartPcts`; null where no unclaimed point sits within `maxLeadM`
 * behind that corner's start — a corner the reference took flat, or one whose
 * braking belongs to a corner before it. If no backward point is available,
 * the earliest point inside the section's ownership interval is used.
 *
 * `brakePointsM` should already be filtered down to points worth attributing
 * (see brakeCuePoints.ts) so a stabilising dab or raw-pedal noise cannot stand
 * in for a braking zone.
 */
export function assignCornerBrakePoints({
  cornerStartPcts,
  cornerEndPcts,
  brakePointsM,
  brakeReleasesM,
  trackLengthM,
  maxLeadM,
}: CornerBrakePointAssignment): (number | null)[] {
  const owners: (number | null)[] = new Array(cornerStartPcts.length).fill(
    null
  );
  if (!(trackLengthM > 0) || brakePointsM.length === 0) return owners;

  const claimed = new Uint8Array(brakePointsM.length);
  const input = {
    cornerStartPcts,
    cornerEndPcts,
    brakePointsM,
    brakeReleasesM,
    trackLengthM,
    maxLeadM,
  };

  for (let c = 0; c < cornerStartPcts.length; c++) {
    const cornerStartM = cornerStartPcts[c] * trackLengthM;
    let bestIdx = -1;
    let bestLeadM = Number.POSITIVE_INFINITY;
    for (let p = 0; p < brakePointsM.length; p++) {
      if (claimed[p]) continue;
      const leadM = signedLapDelta(brakePointsM[p], cornerStartM, trackLengthM);
      if (leadM < 0 || leadM > maxLeadM) continue;
      if (leadM < bestLeadM) {
        bestLeadM = leadM;
        bestIdx = p;
      }
    }
    if (bestIdx < 0) bestIdx = firstPointInOwnershipInterval(c, claimed, input);

    if (bestIdx >= 0) {
      claimed[bestIdx] = 1;
      owners[c] = brakePointsM[bestIdx];
    }
  }

  return owners;
}

/**
 * Return the earliest unclaimed brake point in the corner's own **first half**,
 * or -1.
 *
 * Braking *for* a corner starts at its entry, so where it falls inside the
 * section at all it falls at the beginning. Braking for the corner *after*,
 * when it starts inside this one, starts late in it — which is what the half
 * separates, and nothing else in the data does:
 *
 *   - Okayama's Revolver Corner (2135-2259 m) runs into Piper (2270 m). The
 *     braking for Piper begins around 2230, inside Revolver but past its
 *     midpoint of 2197, so Revolver cannot take it and Piper claims it on its
 *     own backward search. Bounding at Revolver's *end* would not have helped:
 *     the point is genuinely inside it.
 *   - Okayama's Hobbs Corner (2756-2920 m) ends 73 m before Mike Knight starts
 *     at 2993, and the braking for Mike Knight lands in that gap — well past
 *     Hobbs' midpoint of 2838, so it stays Mike Knight's.
 *   - Imola's Acque Minerali is split into abutting halves at 0.575, and the
 *     complex is braked for once, from inside the first half. That is at the
 *     beginning of it, so the first half keeps it and the second half is left
 *     with none rather than being credited with braking that was not its own.
 */
function firstPointInOwnershipInterval(
  c: number,
  claimed: Uint8Array,
  {
    cornerStartPcts,
    cornerEndPcts,
    brakePointsM,
    trackLengthM,
  }: CornerBrakePointAssignment
): number {
  const cornerStartM = cornerStartPcts[c] * trackLengthM;
  const lengthM = signedLapDelta(
    cornerStartM,
    cornerEndPcts[c] * trackLengthM,
    trackLengthM
  );
  if (!(lengthM > 0)) return -1;
  const spanM = lengthM / 2;

  let best = -1;
  let bestIntoM = Number.POSITIVE_INFINITY;
  for (let p = 0; p < brakePointsM.length; p++) {
    if (claimed[p]) continue;
    const intoM = signedLapDelta(cornerStartM, brakePointsM[p], trackLengthM);
    if (intoM < 0 || intoM >= spanM) continue;
    if (intoM < bestIntoM) {
      bestIntoM = intoM;
      best = p;
    }
  }
  return best;
}

/**
 * Where each brake application in `brakePointsM` was released, parallel to it;
 * NaN where no release is found within `maxZoneM`.
 *
 * Note the cue points are merged across re-applications within
 * BRAKE_CUE_MERGE_M while this takes the *first* release after each one, so a
 * dabbed zone reads as ending earlier than it does. That only makes the
 * continuation rule fire less often, never more.
 */
export function brakeReleasesFor(
  brakePointsM: Float32Array,
  brakeOffM: Float32Array,
  trackLengthM: number,
  maxZoneM: number
): Float32Array {
  const releases = new Float32Array(brakePointsM.length).fill(Number.NaN);
  if (!(trackLengthM > 0) || brakeOffM.length === 0) return releases;

  for (let i = 0; i < brakePointsM.length; i++) {
    const idx = nextEventIndex(
      brakeOffM,
      brakeOffM.length,
      brakePointsM[i],
      trackLengthM,
      maxZoneM
    );
    if (idx >= 0) releases[i] = brakeOffM[idx];
  }
  return releases;
}

export interface CornerBrakePointDeltaInput {
  /** The reference lap's brake point for this corner, from assignCornerBrakePoints. */
  referenceBrakeM: number;
  trackLengthM: number;
  driverBrakeOnM: Float32Array;
  driverBrakeOnCount: number;
  /** This corner's start and end, in metres. */
  cornerStartM: number;
  cornerEndM: number;
  /** How far before the corner's start to look for the driver's application. */
  lookbackM: number;
}

/**
 * Positive means the driver braked later than the reference, negative
 * earlier — same numeric sign the old header readout used. The panel colours
 * positive/later green, which is the opposite of the old header's colouring
 * for this same sign; that mapping lives in LastCornerPanel.tsx, not here.
 *
 * The driver's application is looked for in the corner's own approach — from
 * `lookbackM` before its start through to its end, the same reach
 * `assignCornerBrakePoints` gives the reference. Anywhere in there counts, so
 * braking 200 m off the reference reports as 200 m rather than disappearing:
 * a fixed radius around the reference point used to drop exactly the largest
 * differences, which are the ones worth reading, and a blank chip is
 * indistinguishable from "the reference took this corner flat".
 *
 * Among the candidates the one nearest the reference point wins. Note the
 * driver's list is every crossing of the pedal threshold, unfiltered — so a
 * stabilising dab nearer the reference point than the real application is
 * still what gets reported.
 *
 * Returns null when the driver braked nowhere in that stretch. That is
 * independent of (and must not blank) the corner's time/apex-speed result.
 */
export function compareCornerBrakePoint({
  referenceBrakeM,
  trackLengthM,
  driverBrakeOnM,
  driverBrakeOnCount,
  cornerStartM,
  cornerEndM,
  lookbackM,
}: CornerBrakePointDeltaInput): number | null {
  if (!(trackLengthM > 0)) return null;

  // signedLapDelta resolves a span that crosses the start/finish line, so the
  // window below is contiguous either way; this only rejects a corner with no
  // length to it.
  const spanM = signedLapDelta(cornerStartM, cornerEndM, trackLengthM);
  if (!(spanM > 0)) return null;

  let best = -1;
  let bestAbsM = Number.POSITIVE_INFINITY;
  for (let i = 0; i < driverBrakeOnCount; i++) {
    // Positive means this application sits before the corner's start;
    // negative means it is inside the corner, up to -spanM at its end.
    const beforeStartM = signedLapDelta(
      driverBrakeOnM[i],
      cornerStartM,
      trackLengthM
    );
    if (beforeStartM > lookbackM || beforeStartM < -spanM) continue;

    const absM = Math.abs(
      signedLapDelta(referenceBrakeM, driverBrakeOnM[i], trackLengthM)
    );
    if (absM <= bestAbsM) {
      bestAbsM = absM;
      best = i;
    }
  }
  if (best < 0) return null;

  return Math.round(
    signedLapDelta(referenceBrakeM, driverBrakeOnM[best], trackLengthM)
  );
}
