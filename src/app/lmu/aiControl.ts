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
