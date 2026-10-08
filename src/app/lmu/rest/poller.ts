import { fnv1a32 } from '../hash';
import {
  REST_BACKOFF_FACTOR,
  REST_MAX_INTERVAL_MS,
  REST_RETRY_DELAY_MS,
  REST_RETRY_LIMIT,
} from './constants';
import { LMU_REST_TASKS, type LmuRestTask } from './tasks';
import { resetLmuRestData, type LmuRestData } from './state';

/**
 * Polls LMU's REST API outside the telemetry loop.
 *
 * The loop runs on an 8 ms budget (see TELEMETRY_POLL_INTERVAL in
 * lmuSdkBridge.ts) and a loopback connect can take a second to fail. So nothing
 * here is ever awaited by the loop: this owns its own setTimeout chain, writes
 * into the shared LmuRestData, and the loop reads that object synchronously.
 *
 * CPU, which is the reason for most of the machinery below:
 *
 * - A response identical to the previous one is **not parsed at all**. The body
 *   is hashed and compared first, and only a changed hash pays for JSON.parse
 *   and the parsers.
 * - An unchanged response also grows the task's interval by REST_BACKOFF_FACTOR
 *   up to REST_MAX_INTERVAL_MS. A pit menu nobody is touching settles from its
 *   base rate to the cap within a handful of polls, after which the steady
 *   cost is one request per cap-interval and one hash pass over a few KB.
 * - A changed response resets the interval, so the moment the driver opens the
 *   pit menu it is responsive again.
 *
 * Absence is the common case and must be cheap: most people run iRacing, and an
 * older LMU has no REST API at all. A refused connection on the first request
 * after activation latches every task off at once and logs a single line, so a
 * session costs one failed connect rather than one per task per interval.
 */

export type LmuRestFailure =
  | 'refused'
  | 'timeout'
  | 'status'
  | 'network'
  /**
   * Nothing to serve yet, and that is not a fault.
   *
   * A tape's REST records are interleaved with its snapshots, so early in
   * playback a path legitimately has no body yet. Counting that as a failure
   * would latch the task off three seconds into every replay. Retried at the
   * base interval, indefinitely, without consuming a retry.
   */
  | 'pending';

export type LmuRestResponse =
  | { readonly ok: true; readonly body: string }
  | { readonly ok: false; readonly reason: LmuRestFailure };

/** Injected so specs drive the poller with no server and no sockets. */
export type LmuRestTransport = (path: string) => Promise<LmuRestResponse>;

export interface LmuRestPollerLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
}

export interface LmuRestPollerOptions {
  data: LmuRestData;
  transport: LmuRestTransport;
  logger?: LmuRestPollerLogger;
  tasks?: readonly LmuRestTask[];
}

export interface LmuRestPoller {
  /** True while LMU is running. Turning it off clears the data. */
  setActive: (active: boolean) => void;
  /** Re-runs the one-shot tasks, for a track or session change. */
  invalidateOnce: () => void;
  stop: () => void;
}

interface TaskState {
  intervalMs: number;
  hash: number | undefined;
  failures: number;
  /** Latched off until the next activation. */
  missing: boolean;
  /** A one-shot task that has already landed. */
  satisfied: boolean;
  inFlight: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
}

export function createLmuRestPoller({
  data,
  transport,
  logger,
  tasks = LMU_REST_TASKS,
}: LmuRestPollerOptions): LmuRestPoller {
  const states = new Map<string, TaskState>(
    tasks.map((task) => [
      task.id,
      {
        intervalMs: task.baseIntervalMs,
        hash: undefined,
        failures: 0,
        missing: false,
        satisfied: false,
        inFlight: false,
        timer: undefined,
      },
    ])
  );

  let active = false;
  let stopped = false;
  /**
   * Set once a connection is refused before anything has ever answered, which
   * means the API is not there at all rather than one resource being absent.
   */
  let absent = false;
  let reportedAbsent = false;

  const stateOf = (task: LmuRestTask) => states.get(task.id) as TaskState;

  const clearTimers = () => {
    states.forEach((state) => {
      if (state.timer !== undefined) clearTimeout(state.timer);
      state.timer = undefined;
    });
  };

  const schedule = (task: LmuRestTask, delayMs: number) => {
    const state = stateOf(task);
    if (stopped || !active || state.missing || absent) return;
    if (state.timer !== undefined) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      state.timer = undefined;
      void run(task);
    }, delayMs);
  };

  const applyBody = (task: LmuRestTask, body: string): boolean => {
    const state = stateOf(task);
    const hash = fnv1a32(body);
    if (hash === state.hash) return false;
    state.hash = hash;

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      // Served something that is not JSON. Treated as a changed-but-useless
      // response: the hash is remembered, so an endpoint stuck on a non-JSON
      // error page is not re-parsed every interval.
      return true;
    }

    let sessionChanged = false;
    for (const output of task.outputs) {
      const value = output.parse(payload);
      if (value === undefined) continue;
      output.apply(data, value);
      if (output.target === 'session') sessionChanged = true;
    }
    if (sessionChanged) data.revision += 1;
    return true;
  };

  const run = async (task: LmuRestTask) => {
    const state = stateOf(task);
    if (stopped || !active || state.missing || absent || state.inFlight) return;
    state.inFlight = true;

    let response: LmuRestResponse;
    try {
      response = await transport(task.path);
    } catch {
      // A transport is contracted to resolve, not reject. Treat a throw as a
      // network failure rather than letting it escape into an unhandled
      // rejection and kill the chain.
      response = { ok: false, reason: 'network' };
    } finally {
      state.inFlight = false;
    }

    if (stopped || !active) return;

    if (!response.ok) {
      // Not an error: the source has nothing for this path yet. Try again at
      // the base rate without spending a retry.
      if (response.reason === 'pending') {
        schedule(task, task.baseIntervalMs);
        return;
      }

      // Nothing has ever answered and the port refused: the API is not there.
      if (response.reason === 'refused' && state.hash === undefined) {
        absent = true;
        clearTimers();
        if (!reportedAbsent) {
          reportedAbsent = true;
          logger?.info(
            '[lmuRest] No REST API on this port; LMU REST properties unavailable'
          );
        }
        return;
      }

      state.failures += 1;
      if (state.failures >= REST_RETRY_LIMIT) {
        state.missing = true;
        logger?.warn(
          `[lmuRest] Giving up on ${task.path} after ${state.failures} failures (${response.reason})`
        );
        return;
      }
      schedule(task, REST_RETRY_DELAY_MS);
      return;
    }

    state.failures = 0;
    const changed = applyBody(task, response.body);

    if (task.mode === 'once') {
      state.satisfied = true;
      return;
    }

    state.intervalMs = changed
      ? task.baseIntervalMs
      : Math.min(state.intervalMs * REST_BACKOFF_FACTOR, REST_MAX_INTERVAL_MS);
    schedule(task, state.intervalMs);
  };

  const startAll = () => {
    tasks.forEach((task) => {
      const state = stateOf(task);
      if (state.missing || (task.mode === 'once' && state.satisfied)) return;
      // First request immediately: waiting a full interval for a pit-stop
      // estimate that is already available is a visible delay.
      schedule(task, 0);
    });
  };

  return {
    setActive: (next: boolean) => {
      if (stopped || next === active) return;
      active = next;
      if (!active) {
        clearTimers();
        resetLmuRestData(data);
        states.forEach((state) => {
          state.intervalMs = 0;
          state.hash = undefined;
          state.failures = 0;
          state.missing = false;
          state.satisfied = false;
        });
        tasks.forEach((task) => {
          stateOf(task).intervalMs = task.baseIntervalMs;
        });
        // Deliberately not clearing `absent`: a build with no REST API will
        // not grow one between sessions, and re-probing every activation is
        // the retry storm this avoids.
        return;
      }
      startAll();
    },

    invalidateOnce: () => {
      if (stopped) return;
      tasks.forEach((task) => {
        if (task.mode !== 'once') return;
        const state = stateOf(task);
        state.satisfied = false;
        state.hash = undefined;
        if (active) schedule(task, 0);
      });
    },

    stop: () => {
      stopped = true;
      active = false;
      clearTimers();
    },
  };
}
