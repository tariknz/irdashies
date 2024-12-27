import type { Driver } from '@irdashies/types';
import { shallow } from 'zustand/shallow';

export const driverListCompare = (a?: Driver[], b?: Driver[]) => {
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
