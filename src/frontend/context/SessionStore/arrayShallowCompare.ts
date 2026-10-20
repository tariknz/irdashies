import { shallow } from 'zustand/shallow';

/**
 * Compares two session arrays by content, one level into each element.
 *
 * Everything the session store hands out crosses IPC first: the main process
 * sends a snapshot with `webContents.send`, which structured-clones it. No
 * object identity survives that, so these comparisons are the only thing
 * standing between a session publish and every consumer re-rendering. At two
 * publishes a second, and two more per driver joining, that is the difference
 * between the standings pipeline running when the grid changes and running
 * constantly.
 *
 * Element comparison used to be `shallow` alone, which compares own keys with
 * `Object.is`. That is enough for a driver whose fields are all primitives --
 * iRacing's are -- but an LMU driver carries `LmuRating`, a nested object, and
 * the clone makes it a different object every time however the mapper built
 * it. So no two consecutive snapshots ever compared equal under LMU, and the
 * whole standings pipeline re-ran on every publish for a grid that had not
 * moved.
 *
 * One level deeper fixes it and no further: a driver's nested values are flat
 * records, so depth two is the whole structure. Bounded on purpose -- an
 * unbounded deep compare on a payload this size would trade one cost for
 * another.
 */

const isComparableObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null;

/**
 * `shallow`, but a nested object is compared by its own contents rather than
 * by identity.
 *
 * Only reached when `shallow` has already said no, so the common case still
 * costs exactly what it did before.
 */
const elementCompare = (a: unknown, b: unknown): boolean => {
  if (shallow(a, b)) return true;
  if (!isComparableObject(a) || !isComparableObject(b)) return false;

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!Object.hasOwn(b, key)) return false;
    const aValue = (a as Record<string, unknown>)[key];
    const bValue = (b as Record<string, unknown>)[key];
    if (Object.is(aValue, bValue)) continue;
    // The one extra level. A nested value that is not an object has already
    // failed, since Object.is is the whole test for a primitive.
    if (
      !isComparableObject(aValue) ||
      !isComparableObject(bValue) ||
      !shallow(aValue, bValue)
    ) {
      return false;
    }
  }

  return true;
};

export const arrayShallowCompare = (a?: unknown[], b?: unknown[]) => {
  if (!a && !b) return true;
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (!elementCompare(a[i], b[i])) {
      return false;
    }
  }

  return true;
};
