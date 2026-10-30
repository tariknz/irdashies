/**
 * The handle that joins a websocket entry to a car.
 *
 * The `LiveStandings` topic identifies a car by driver name; shared memory
 * identifies it by slot (`mID`, which is this app's CarIdx). The driver name is
 * the only field both carry, so it has to be the join key -- and the two sides
 * do not spell it identically. LMU prefixes a car number onto the name in some
 * views, pads with whitespace in others, and the websocket's casing has no
 * reason to match scoring's.
 *
 * So: trim, drop an embedded `#12`, collapse runs of whitespace, lowercase.
 * The same normalisation doX's `NormalizeDriverKey` applies, arrived at
 * independently of it and then checked against it.
 *
 * Returns an empty string for anything unusable, which callers treat as "no
 * key" rather than as a driver named "".
 */
const CAR_NUMBER = /#\s*[0-9]+/g;
const WHITESPACE = /\s+/g;

export const lmuDriverKey = (name?: string | null): string => {
  if (typeof name !== 'string') return '';
  return name
    .replace(CAR_NUMBER, ' ')
    .replace(WHITESPACE, ' ')
    .trim()
    .toLowerCase();
};
