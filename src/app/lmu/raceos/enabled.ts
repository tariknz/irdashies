/**
 * Whether irDashies uses RaceOS at all.
 *
 * On: LMU ranks, progress, badges and approximate DR gain are fetched and
 * shown. While this is false the bridge builds none of the rating feature --
 * no ticket is asked of the sim, no request goes to raceos.gg, no rating
 * cache is read or written, and a replay ignores any ratings baked into its
 * tape.
 *
 * Its own module so the bridge spec can switch it off and keep the rest of
 * the feature covered.
 */
export const RACEOS_ENABLED = true;
