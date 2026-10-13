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

/**
 * How long to wait before probing again once the API looks absent, and the
 * ceiling that wait grows to.
 *
 * The absent latch used to be permanent for the life of the process, on the
 * reasoning that a build without a REST API will not grow one. That is wrong
 * in the case that matters: the API is a server inside the sim, and its port
 * need not be open at the moment the app first reaches shared memory. A single
 * refused connection during that window turned every REST-backed value --
 * pit-stop and repair estimates, the refuel target, virtual energy, the
 * weather forecast -- off for the rest of the run.
 *
 * So the latch now expires. Doubling from 30 s to a 5 minute ceiling recovers
 * within half a minute when the API is merely late, while an installation that
 * really has none settles at one failed connect every five minutes.
 */
export const REST_ABSENT_RETRY_MS = 30_000;
export const REST_ABSENT_MAX_RETRY_MS = 300_000;
