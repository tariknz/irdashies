import type { ActiveSimulator } from '@irdashies/types';
import type { SimulatorUsage } from '../storage/simulatorUsage';

/** Person properties in PostHog, set from the simulators used. */
export interface SimulatorUsageProperties {
  $set: {
    /** The simulator that connected most recently. */
    last_simulator: ActiveSimulator;
  } & Partial<Record<`used_${ActiveSimulator}`, true>> &
    /** How long each was connected since the previous report, in seconds. */
    Partial<Record<`${ActiveSimulator}_connected_seconds`, number>>;
  /**
   * The simulator that connected first in the period reported. PostHog keeps
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
    properties.$set[`${simulator}_connected_seconds`] = Math.round(
      (usage[simulator]?.ms ?? 0) / 1000
    );
  }
  return properties;
};
