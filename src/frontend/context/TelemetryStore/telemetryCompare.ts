import type { TelemetryVar } from '@irdashies/types';

/**
 * Compares telemetry value arrays for equality to avoid unnecessary re-renders.
 * Since we are publishing telemetry at 60fps we need to ensure that we only re-render
 * when the values actually change.
 */
export const telemetryCompare = (
  a?: TelemetryVar<number[] | boolean[]>,
  b?: TelemetryVar<number[] | boolean[]>
) => {
  return arrayCompare(a?.value, b?.value);
};

/**
 * Compares arrays for equality to avoid unnecessary re-renders.
 */
export const arrayCompare = (a?: unknown[], b?: unknown[]) => {
  if (!a && !b) return true; // Both are undefined or null
  if (!a || !b) return false; // Only one is undefined or null
  if (a.length !== b.length) return false; // Array lengths differ

  // Compare array values
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
};
