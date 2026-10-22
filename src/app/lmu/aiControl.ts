/**
 * Whether an LMU entry is driven by the sim rather than a person.
 *
 * `mControl` in LMU's scoring block: 0 local player, 1 local AI, 2 remote,
 * 3 replay. Only 1 is an AI.
 *
 * Its own module rather than a corner of mapSession.ts because two callers
 * need it and they are on opposite sides of the session mapper: the mapper
 * itself, to decide what a driver's row carries, and the bridge, to decide
 * whose name is sent to the rating service. A predicate shared across that
 * boundary should not live inside one of its users -- and a spec that stubs
 * the whole session mapper would otherwise take this with it, which is how
 * the AI filter first shipped doing nothing.
 */
const LMU_CONTROL_AI = 1;

/**
 * True for an AI, false for a person, undefined when the sim did not say.
 *
 * Three states deliberately. Callers that withhold something from an AI must
 * treat "did not say" as a person: an older build, or a snapshot taken before
 * control is populated, must not quietly cost a human their rank.
 */
export function isLmuAiControlled(control?: number): boolean | undefined {
  return control === undefined ? undefined : control === LMU_CONTROL_AI;
}

/**
 * The slot the player occupies, or -1.
 *
 * The second of the two signals that identify your own entry. `mIsPlayer` on
 * the entry is the first; this is the one the telemetry block states directly,
 * and either alone is enough. Taking both matters because the case that needs
 * it -- sitting in the garage before taking the car -- is the case where the
 * sim's description of your entry is least like the rest of the session.
 */
export const lmuPlayerSlot = (raw: {
  readonly playerHasVehicle?: boolean;
  readonly playerVehicleIdx?: number;
}): number =>
  raw.playerHasVehicle &&
  typeof raw.playerVehicleIdx === 'number' &&
  raw.playerVehicleIdx >= 0
    ? raw.playerVehicleIdx
    : -1;

/**
 * Whether an entry is one nothing should be withheld from an AI for.
 *
 * The player is never an AI, whatever `mControl` says about their car.
 *
 * That qualifier is the whole point. LMU holds your car under AI control until
 * you take it, so your own entry reads `mControl == 1` while you sit in the
 * garage -- and a plain control test therefore called you an AI, kept your
 * name out of the rating lookup, withheld the rank from your row and drew the
 * "AI" badge on it. Every other driver was ranked, because every other driver
 * was already in their car. Taking the car flipped control to 0, the lookup
 * finally asked, and the rank appeared and stayed -- which is exactly the
 * shape the bug was reported in.
 *
 * Handing your car to the AI mid-race is the same state, and the answer there
 * is the same: it is still your car and your rank.
 */
export const isLmuAiEntry = (entry: {
  readonly control?: number;
  readonly isPlayer?: boolean;
}): boolean | undefined =>
  entry.isPlayer ? false : isLmuAiControlled(entry.control);
