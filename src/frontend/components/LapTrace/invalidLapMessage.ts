import type { LapInvalidReason } from '@irdashies/types';

/**
 * What to tell the driver about a lap that can no longer become the
 * reference.
 *
 * Kept short enough to sit on one line in a narrowly-sized widget, and
 * deliberately plain: on a fresh session the first thing shown is almost
 * always the out-lap message, so these read as status, not as errors.
 *
 * `satisfies` rather than a plain annotation so a new reason added to the
 * union fails the build here instead of falling through to a blank line.
 */
const MESSAGES = {
  'out-lap': "Out-lap — this lap can't be recorded",
  'partial-lap': 'Joined mid-lap — waiting for the start/finish line',
  reset: 'Lap restarted after a reset',
  pitted: "Pit lap — this lap can't be recorded",
  'off-world': "Off track — this lap can't be recorded",
  incident: "Incident — this lap can't be recorded",
  // LMU reports a bare void flag with no cause attached, so none is claimed.
  'sim-invalidated': 'Lap invalidated by the sim',
  spin: "Spin detected — this lap can't be recorded",
  discontinuity: "Lap interrupted — this lap can't be recorded",
  'too-long': 'Lap too long to record',
} satisfies Record<LapInvalidReason, string>;

export const invalidLapMessage = (reason: LapInvalidReason): string =>
  MESSAGES[reason];
