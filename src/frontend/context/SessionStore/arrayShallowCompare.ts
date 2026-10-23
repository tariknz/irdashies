import { shallow } from 'zustand/shallow';

/**
 * Element-wise `shallow`: own keys compared with `Object.is`.
 *
 * Deliberately no deeper, which was tried and reverted. Everything the session
 * store hands out has crossed IPC and been structured-cloned, so a driver's
 * nested `LmuRating` is a new object every publish and this returns false on
 * every LMU publish however it is written. Comparing one level deeper made it
 * return true for an unchanged grid -- but the renderer-side instrument then
 * showed the standings rebuild it was meant to avoid never exceeded 8ms, while
 * the deeper compare ran, and failed, over every nested array this is used on:
 * the session list, whose elements hold result arrays of their own.
 *
 * So it bought nothing and cost something on every publish. If this is
 * revisited, measure the rebuild first -- `standingsCost.ts` already reports
 * it -- and make the comparison cheap for the arrays that cannot match rather
 * than thorough for the one that can.
 */

export const arrayShallowCompare = (a?: unknown[], b?: unknown[]) => {
  if (!a && !b) return true;
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (!shallow(a[i], b[i])) {
      return false;
    }
  }

  return true;
};
