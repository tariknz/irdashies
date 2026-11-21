import { normalisePct } from './lapSamples';

/**
 * Detects that the car did not drive to where it now is.
 *
 * iRacing's Active Reset teleports the car back to a saved point with the
 * speed and pedal positions it had when the point was set — drivers use it to
 * practise one corner over and over. The sim reports no event for it: the only
 * evidence is that lap distance moved further between two frames than anything
 * on wheels could have.
 *
 * The same test catches the other ways position stops being continuous — a
 * tow, a grid placement, a replay scrub — which all want the same response
 * from a lap recorder: throw away the partial lap and resynchronise here.
 *
 * Deliberately kinematic. EnterExitReset reports what the reset *key would do*
 * (0 enter / 1 exit / 2 reset), not that a reset happened, so it is no help.
 *
 * The awkward part is that a lap is a loop: "forward by 4500 m" and "back by
 * 500 m" are the same pair of positions on a 5 km track. Rather than always
 * believing the shorter reading, this reads the move forwards first — cars
 * drive forwards, and crossing the start/finish line is a small forward move —
 * and only calls it a jump when the forward reading is impossible for the time
 * elapsed. That keeps a long forward tow, or a stalled telemetry delivery, out
 * of the backward case it would otherwise alias into on a short track.
 */

/**
 * A backward move beyond this is a jump, not driving. Well clear of
 * MAX_BACKWARD_M (5 m), which covers a spin or LapDistPct dither; a car
 * reversing at 10 m/s covers 0.17 m per 60 Hz frame, so continuous reverse
 * can never reach this — only an instantaneous jump can.
 */
export const JUMP_BACK_M = 25;

/**
 * A forward move beyond this is questionable, but only questionable: a stalled
 * telemetry delivery covers real ground. Aligned with MAX_SAMPLE_GAP_M, and
 * always followed by the speed check below.
 */
export const JUMP_FORWARD_M = 50;

/**
 * 450 km/h — matches MAX_PLAUSIBLE_SPEED_KMH in the incident detector. A
 * forward move is only a jump if covering it would have needed more than this.
 */
export const MAX_PLAUSIBLE_SPEED_MS = 125;

export type PositionJump =
  /** Continuous motion, including a normal start/finish crossing. */
  | 'none'
  /** Teleported backwards — the Active Reset case. */
  | 'backward'
  /** Covered ground forwards faster than any car could. */
  | 'forward'
  /** SessionTime went backwards: a replay scrub or a session restart. */
  | 'timeRewind';

/**
 * Classify the move between two consecutive frames. Distances are lap metres.
 */
export function detectPositionJump(
  prevDistanceM: number,
  distanceM: number,
  prevSessionTime: number,
  sessionTime: number,
  trackLengthM: number
): PositionJump {
  if (
    !Number.isFinite(prevDistanceM) ||
    !Number.isFinite(distanceM) ||
    !Number.isFinite(prevSessionTime) ||
    !Number.isFinite(sessionTime) ||
    !(trackLengthM > 0)
  ) {
    return 'none';
  }

  if (sessionTime < prevSessionTime) return 'timeRewind';

  // Distance travelled reading the move as forwards, in [0, trackLengthM).
  const forwardM =
    normalisePct((distanceM - prevDistanceM) / trackLengthM) * trackLengthM;
  if (forwardM <= JUMP_FORWARD_M) return 'none';

  // ...and the same move read as backwards, in (-trackLengthM, 0].
  const backwardM = forwardM - trackLengthM;
  if (backwardM > -JUMP_BACK_M) return 'none';

  const dt = sessionTime - prevSessionTime;
  if (dt > 0 && forwardM / dt <= MAX_PLAUSIBLE_SPEED_MS) return 'none';

  // Undrivable either way round. Name it by the shorter of the two readings —
  // a reset point is nearly always behind the car, not most of a lap ahead.
  return forwardM + backwardM > 0 ? 'backward' : 'forward';
}
