/**
 * Whether irDashies uses RaceOS at all.
 *
 * Off: LMU ranks and badges are not shown. While this is false the bridge
 * builds none of the rating feature -- no ticket is asked of the sim, no
 * request goes to raceos.gg, no rating cache is read or written, and a replay
 * ignores any ratings baked into its tape. The code is kept so turning it back
 * on is this one line.
 *
 * Its own module so the bridge spec can switch it on and keep the rest of the
 * feature covered.
 */
export const RACEOS_ENABLED = false;
