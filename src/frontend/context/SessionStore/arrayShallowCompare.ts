import { shallow } from 'zustand/shallow';

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
