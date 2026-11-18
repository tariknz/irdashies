import type { ActiveSimulator } from '@irdashies/types';
import type { SimulatorUsage } from '../storage/simulatorUsage';

const MINUTE_MS = 60 * 1000;

/** Person properties in PostHog, set from the simulators used. */
export interface SimulatorUsageProperties {
  $set: {
    /** The simulator used most recently. */
    last_simulator: ActiveSimulator;
  } & Partial<Record<`used_${ActiveSimulator}`, true>> &
    /**
     * How long each showed the track since the previous report, in whole
     * minutes, rounded up: in the car, a replay, spectating or LMU's monitor.
     * Menus and the garage do not count.
     */
    Partial<Record<`${ActiveSimulator}_connected_minutes`, number>>;
  /**
   * The simulator used first in the period reported. PostHog keeps
   * the first value it receives, so it names the first simulator used since
   * this installation started reporting them.
   */
  $set_once: { first_simulator: ActiveSimulator };
}

/**
 * The person properties for the simulators used since the last report, or
 * undefined when none was. Only simulator ids and durations leave the
 * installation.
 */
export const buildSimulatorUsageProperties = (
  usage: SimulatorUsage
): SimulatorUsageProperties | undefined => {
  const simulators = Object.keys(usage) as ActiveSimulator[];
  if (simulators.length === 0) return undefined;
  const place = (simulator: ActiveSimulator, key: 'first' | 'last') =>
    usage[simulator]?.[key] ?? 0;
  const byFirst = [...simulators].sort(
    (a, b) => place(a, 'first') - place(b, 'first')
  );
  const byLast = [...simulators].sort(
    (a, b) => place(a, 'last') - place(b, 'last')
  );
  const properties: SimulatorUsageProperties = {
    $set: { last_simulator: byLast[byLast.length - 1] },
    $set_once: { first_simulator: byFirst[0] },
  };
  for (const simulator of byFirst) {
    properties.$set[`used_${simulator}`] = true;
    // Rounded up, so a minute begun counts as one.
    properties.$set[`${simulator}_connected_minutes`] = Math.ceil(
      (usage[simulator]?.ms ?? 0) / MINUTE_MS
    );
  }
  return properties;
};
