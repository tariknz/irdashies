/**
 * LMU's local REST API.
 *
 * The sim serves a small JSON API on a fixed loopback port, carrying things its
 * shared-memory block does not: pit-stop and repair estimates, the pit menu's
 * refuel target, virtual-energy capacity, component wear, the weather forecast.
 *
 * The port is not a user choice -- it is fixed by the sim -- so this is a
 * constant with an environment escape hatch for debugging, following
 * `SIM_STATUS_URI` in src/app/irsdk/node/constants.ts and the
 * TINYPEDAL_TRACKMAP_DIR override in src/app/lmu/trackMap.ts. Nothing needs a
 * settings toggle: when nothing answers the port, the poller latches itself off
 * after one failed connect.
 *
 * 127.0.0.1 rather than localhost: on Windows, localhost can resolve IPv6-first
 * and stall before falling back.
 */
export const LMU_REST_ORIGIN = 'http://127.0.0.1:6397';

/** The origin to poll, overridable for debugging against another host. */
export const lmuRestOrigin = (): string =>
  process.env.IRDASHIES_LMU_REST_URL?.trim() || LMU_REST_ORIGIN;

/** Per-request ceiling. The API is loopback, so a slow reply means trouble. */
export const REST_TIMEOUT_MS = 1000;

/** Consecutive failures before a task gives up until the next activation. */
export const REST_RETRY_LIMIT = 3;

/** Delay between retries of a failing task. */
export const REST_RETRY_DELAY_MS = 1000;

/**
 * Growth applied to a task's interval each time its response is byte-identical
 * to the previous one, and the ceiling that growth stops at.
 *
 * The pit menu and the wear figures are static for most of a stint, so polling
 * them at their base rate would burn CPU to learn nothing. Backing off to the
 * cap costs roughly two requests per cap-interval with no JSON parsing at all.
 */
export const REST_BACKOFF_FACTOR = 1.5;
export const REST_MAX_INTERVAL_MS = 5000;
