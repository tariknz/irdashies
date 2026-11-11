/**
 * The order of menu labels everywhere in the settings menu: alphanumeric,
 * ignoring case, so "Lap Timer 2" comes before "Lap Timer 10" whether the
 * list is by category or alphabetical.
 */
export const compareMenuLabels = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
