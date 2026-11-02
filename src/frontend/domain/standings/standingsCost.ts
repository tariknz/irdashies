import logger from '@irdashies/utils/logger';

/**
 * Reports what a standings rebuild costs, when it costs enough to matter.
 *
 * The main process already logs a slow session update, and has never logged
 * one: building and broadcasting a snapshot measures well under a millisecond.
 * Which left the renderer, where nothing was instrumented at all -- so every
 * answer about the join-time stutter so far has been reasoning about the half
 * that was measured. This is the other half.
 *
 * Always on rather than behind a flag, for the same reason the main process's
 * threshold warning is: by the time anyone wants this number the sim has
 * already stuttered, and they are reading the log they have.
 *
 * Throttled, because a rebuild that is slow once is slow every time and a line
 * per publish would bury the log it is meant to explain.
 */

/** Above this, a rebuild is worth a line. One frame at 60 Hz is 16.7ms. */
const SLOW_REBUILD_MS = 8;

const LOG_INTERVAL_MS = 10_000;

interface PathCost {
  lastLoggedAt: number;
  since: number;
  worst: number;
}

/**
 * Per path, because the Standings and Relative widgets rebuild through
 * different code and share nothing but a name. Instrumenting one and reading
 * its silence as covering both is how the last attempt went wrong: the
 * Relative widget was still running with its own uninstrumented rebuild.
 */
const costs = new Map<string, PathCost>();

const costFor = (path: string): PathCost => {
  let cost = costs.get(path);
  if (!cost) {
    cost = { lastLoggedAt: -Infinity, since: 0, worst: 0 };
    costs.set(path, cost);
  }
  return cost;
};

/**
 * Times `build` and reports it if it was slow.
 *
 * Returns whatever `build` returned, so a caller wraps its existing
 * expression rather than restructuring around this.
 */
export const measureStandingsRebuild = <T>(
  path: 'standings' | 'relative',
  drivers: number,
  build: () => T
): T => {
  const startedAt = performance.now();
  const result = build();
  const elapsed = performance.now() - startedAt;

  const cost = costFor(path);
  cost.since += 1;
  if (elapsed > cost.worst) cost.worst = elapsed;

  const now = Date.now();
  if (
    cost.worst >= SLOW_REBUILD_MS &&
    now - cost.lastLoggedAt >= LOG_INTERVAL_MS
  ) {
    logger.warn(
      `[${path}] Slow rebuild: worst ${cost.worst.toFixed(1)}ms over ` +
        `${cost.since} rebuilds for ${drivers} drivers`
    );
    cost.lastLoggedAt = now;
    cost.since = 0;
    cost.worst = 0;
  }

  return result;
};

/** For tests, which must not inherit another test's throttle. */
export const resetStandingsCost = () => {
  costs.clear();
};
