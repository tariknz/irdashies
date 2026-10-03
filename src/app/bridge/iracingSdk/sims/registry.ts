import type { ActiveSimulator } from '@irdashies/types';
import type { SimDefinition } from './types';

/**
 * Every simulator this build can read, discovered from the `sims/` directory.
 *
 * An empty glob compiles to `{}`, which is what makes a simulator optional: a
 * source that is not in the tree is simply not discovered, and the settings
 * window greys it out instead of the build failing on a missing import. This
 * follows the same pattern as the git-excluded `src/local/` modules in
 * `main.ts` and `preload.ts`.
 *
 * Eager, because the answer to "which simulators are available?" is needed
 * synchronously on the first settings render and before the bridge is built.
 * The definition modules are deliberately thin for exactly this reason — the
 * native code they name is behind `createProbe` and `loadBridge`.
 */
const discovered = import.meta.glob<{ default: SimDefinition }>(
  ['./*/simDefinition.ts', '!./*/*.spec.ts'],
  { eager: true }
);

const byPriority = (a: SimDefinition, b: SimDefinition) =>
  b.priority - a.priority;

/**
 * Definitions, highest auto-detect priority first.
 *
 * Exported as a function rather than a constant so tests can reason about it
 * without depending on module-load order.
 */
export const getSimDefinitions = (): SimDefinition[] =>
  Object.values(discovered)
    .map((module) => module.default)
    .filter((definition): definition is SimDefinition => Boolean(definition))
    .sort(byPriority);

/** The ids this build can read, highest auto-detect priority first. */
export const getAvailableSimulators = (): ActiveSimulator[] =>
  getSimDefinitions().map((definition) => definition.id);

export const getSimDefinition = (
  id: ActiveSimulator | undefined
): SimDefinition | undefined =>
  id
    ? getSimDefinitions().find((definition) => definition.id === id)
    : undefined;

export const isSimulatorAvailable = (
  id: ActiveSimulator | undefined
): boolean => Boolean(getSimDefinition(id));
