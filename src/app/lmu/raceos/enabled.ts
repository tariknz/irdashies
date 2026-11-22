import { getRaceosOptIn } from '../../storage/raceos';

/**
 * Whether irDashies may use RaceOS for this process.
 *
 * Requires an explicit user opt-in (About → LMU driver ratings). While this
 * is false the bridge builds none of the rating feature — no ticket is asked
 * of the sim, no request goes to raceos.gg, no rating cache is read or
 * written, and a replay ignores any ratings baked into its tape.
 *
 * Its own module so the bridge spec can switch it on and keep the rest of the
 * feature covered.
 */
export const isRaceosEnabled = (): boolean => getRaceosOptIn();
