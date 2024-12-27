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
  if (!a && !b) return true; // Both are undefined or null
  if (!a || !b) return false; // Only one is undefined or null
  if (a.value.length !== b.value.length) return false; // Array lengths differ

  // Compare array values
  console.log(a, b);
  for (let i = 0; i < a.value.length; i++) {
    if (a.value[i] !== b.value[i]) {
      return false;
    }
  }

  return true;
};
