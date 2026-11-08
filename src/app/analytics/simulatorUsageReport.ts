import type { ActiveSimulator } from '@irdashies/types';
import type { SimulatorUsage } from '../storage/simulatorUsage';

/** Person properties in PostHog, set from the simulators used. */
export interface SimulatorUsageProperties {
  $set: {
    /** The simulator that connected most recently. */
    last_simulator: ActiveSimulator;
  } & Partial<Record<`used_${ActiveSimulator}`, true>>;
  /** Kept from the first report, so it names the first simulator ever used. */
  $set_once: { first_simulator: ActiveSimulator };
}

/**
 * The person properties for the simulators used since the last report, or
 * undefined when none connected. Only simulator ids leave the installation.
 */
export const buildSimulatorUsageProperties = (
  usage: SimulatorUsage
): SimulatorUsageProperties | undefined => {
  const simulators = (Object.keys(usage) as ActiveSimulator[]).sort(
    (a, b) => (usage[a] ?? 0) - (usage[b] ?? 0)
  );
  if (simulators.length === 0) return undefined;
  const properties: SimulatorUsageProperties = {
    $set: { last_simulator: simulators[simulators.length - 1] },
    $set_once: { first_simulator: simulators[0] },
  };
  for (const simulator of simulators) {
    properties.$set[`used_${simulator}`] = true;
  }
  return properties;
};
