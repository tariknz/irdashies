import { fnv1a32 } from '../hash';
import {
  REST_BACKOFF_FACTOR,
  REST_ABSENT_MAX_RETRY_MS,
  REST_ABSENT_RETRY_MS,
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
 *
 * That latch expires rather than holding for the session, because the API is a
 * server inside the sim and its port need not be open at the moment the app
 * first reaches shared memory. It is re-probed on a doubling interval, from
 * REST_ABSENT_RETRY_MS out to REST_ABSENT_MAX_RETRY_MS, so an API that was
 * merely late is picked up within half a minute while an installation that has
 * none settles at one failed connect every few minutes.
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
  | {
      readonly ok: false;
      readonly reason: LmuRestFailure;
      /** The HTTP status, for a `status` failure. */
      readonly status?: number;
      /** What came with it, for a `status` failure. */
      readonly body?: string;
    };

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
  /**
   * Starts a `burst` task polling, or starts it over.
   *
   * The first poll goes out after `delayMs`, and the task then polls at its
   * base interval until `isComplete` -- asked after every answer -- returns
   * true, or until its `burstMs` has passed since that first poll. A call
   * while a burst is waiting or running replaces it, delay and all, so a
   * stream of calls less than `delayMs` apart waits for them to stop.
   */
  burst: (
    taskId: string,
    options: { delayMs: number; isComplete: () => boolean }
  ) => void;
  stop: () => void;
}

interface BurstState {
  isComplete: () => boolean;
  /** When the first poll was due, by Date.now(). */
  startsAt: number;
  /** No poll is sent that would land after this. */
  endsAt: number;
  polls: number;
}

interface TaskState {
  intervalMs: number;
  hash: number | undefined;
  failures: number;
  /** Latched off until the next activation. Never set for an optional task. */
  missing: boolean;
  /**
   * Whether an optional task's absence has been reported.
   *
   * One line when it stops answering and one when it starts, so a log says
   * whether the spectator camera was ever readable without saying it 3000
   * times a session.
   */
  reportedAbsent: boolean;
  /** A one-shot task that has already landed. */
  satisfied: boolean;
  /** The burst a `burst` task is in, or undefined when it is idle. */
  burst: BurstState | undefined;
  /**
   * What each output last parsed this activation, by output id, for a
   * `report` that has to say what is new rather than everything it sees.
   */
  lastParsed: Map<string, unknown>;
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
        reportedAbsent: false,
        satisfied: false,
        burst: undefined,
        lastParsed: new Map(),
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
  /**
   * Whether the server has answered anything this activation, error statuses
   * included: that is the API being there. Its own flag rather than a task's
   * hash, which is dropped whenever a body has to be read afresh -- read off
   * the hash, one reset socket while GetGameState was answering 404 latched
   * every task off for half a minute.
   */
  let answered = false;
  let reportedAbsent = false;
  let absentRetryMs = REST_ABSENT_RETRY_MS;
  /**
   * Bumped whenever the poller is reset, so a request that was already in
   * flight can tell that the world moved while it was away.
   *
   * Checking `stopped || !active` after the await was not enough: deactivate
   * and reactivate while a request is outstanding and the check passes, so the
   * previous session's response was applied into data that had just been
   * cleared.
   */
  let generation = 0;
  let absentTimer: ReturnType<typeof setTimeout> | undefined;

  const stateOf = (task: LmuRestTask) => states.get(task.id) as TaskState;

  const clearTimers = () => {
    states.forEach((state) => {
      if (state.timer !== undefined) clearTimeout(state.timer);
      state.timer = undefined;
    });
  };

  /**
   * Lifts the absent latch after a wait, so the tasks probe once more.
   *
   * Doubling to a ceiling: quick enough to catch an API that was merely slow
   * to open its port, cheap enough that an installation without one settles at
   * a single failed connect every few minutes rather than a retry storm.
   */
  const scheduleAbsentProbe = () => {
    if (stopped || !active || absentTimer !== undefined) return;
    absentTimer = setTimeout(() => {
      absentTimer = undefined;
      if (stopped || !active) return;
      absent = false;
      absentRetryMs = Math.min(absentRetryMs * 2, REST_ABSENT_MAX_RETRY_MS);
      startAll();
    }, absentRetryMs);
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

  /**
   * Hands a body to the task's outputs unless it is the body seen last time.
   * False for a repeat, true otherwise -- a body that is not JSON included,
   * which the outputs see as `undefined`.
   */
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
      // error page is not re-parsed every interval. The outputs still see it,
      // as a payload of nothing, which every parser rejects -- except one that
      // must not hold its last value through an answer it cannot read.
      payload = undefined;
    }

    let sessionChanged = false;
    for (const output of task.outputs) {
      const value = output.parse(payload);
      if (value === undefined) continue;
      // Before the unchanged check: what a parser has to say about a body is
      // worth saying even when there is nothing new to write.
      const report = output.report?.(value, state.lastParsed.get(output.id));
      state.lastParsed.set(output.id, value);
      if (report) logger?.info(report);
      // An output may recognise a value as the one it already holds. Only a
      // session target really cares: those bump `revision`, which costs a
      // full snapshot rebuild and a whole-object broadcast, and a payload
      // that moves every poll for reasons this output does not read would
      // force one each time. An output without the predicate is unaffected.
      if (output.unchanged?.(data, value)) continue;
      output.apply(data, value);
      if (output.target === 'session') sessionChanged = true;
    }
    if (sessionChanged) data.revision += 1;
    return true;
  };

  /** The next interval after a poll that learned nothing, per task ceiling. */
  const backedOff = (task: LmuRestTask, intervalMs: number): number =>
    Math.min(
      intervalMs * REST_BACKOFF_FACTOR,
      task.maxIntervalMs ?? REST_MAX_INTERVAL_MS
    );

  /**
   * After a poll in a burst: ends it once the caller's check passes on an
   * answer, or once another poll would land past its end; otherwise polls
   * again at the base interval.
   *
   * Asked on every answer, changed body or not. The check reads what the
   * caller sees -- the grid on screen, not this response -- so an unchanged
   * body can still be the one that completes it.
   */
  const continueBurst = (task: LmuRestTask, answered: boolean) => {
    const state = stateOf(task);
    const burst = state.burst;
    if (!burst) return;
    burst.polls += 1;
    const elapsed = () =>
      `${burst.polls} polls, ${((Date.now() - burst.startsAt) / 1000).toFixed(1)}s`;
    if (answered && burst.isComplete()) {
      state.burst = undefined;
      logger?.info(`[lmuRest] ${task.path}: complete after ${elapsed()}`);
      return;
    }
    if (Date.now() + task.baseIntervalMs > burst.endsAt) {
      state.burst = undefined;
      logger?.info(
        `[lmuRest] ${task.path}: stopped incomplete after ${elapsed()}`
      );
      return;
    }
    schedule(task, task.baseIntervalMs);
  };

  /**
   * One request for a task, then what its answer calls for: apply it, back
   * off, clear the task's outputs, or mark the API absent -- and the next poll
   * scheduled to match.
   */
  const run = async (task: LmuRestTask) => {
    const state = stateOf(task);
    if (stopped || !active || state.missing || absent || state.inFlight) return;
    // A burst task asks only while a burst the caller started is running.
    if (task.mode === 'burst' && !state.burst) return;
    state.inFlight = true;
    const startedIn = generation;

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

    // A response from before a reset describes a session that has ended.
    if (stopped || !active || generation !== startedIn) {
      // Discarding it is not enough: the reactivation that invalidated it
      // tried to start this task and found inFlight still true, so it never
      // scheduled anything. Dropping out here as well left the task polling
      // nothing for the rest of the session. Reactivation lost a cycle, so
      // this one goes out immediately rather than at the usual interval;
      // `schedule` re-checks stopped, active, missing and absent itself.
      if (!stopped && active) schedule(task, 0);
      return;
    }

    if (response.ok || response.reason === 'status') answered = true;

    if (!response.ok) {
      // Not an error: the source has nothing for this path yet. Try again at
      // the base rate without spending a retry. A burst's window starts over
      // with it: a tape reaches its first teams record when it does, and a
      // burst that spent its sixteen seconds waiting would end before the
      // record it was started for.
      if (response.reason === 'pending') {
        if (state.burst) {
          state.burst.startsAt = Date.now() + task.baseIntervalMs;
          state.burst.endsAt = state.burst.startsAt + (task.burstMs ?? 0);
        }
        schedule(task, task.baseIntervalMs);
        return;
      }

      // Nothing has ever answered and the port refused: the API is not there
      // -- for now. The sim's REST server need not have its port open at the
      // moment the app first reaches shared memory, so this is re-probed
      // rather than latched for the life of the process. Only before any
      // answer, so the latch never holds data an answer wrote: a refusal
      // after one is a path failing, and takes that path's own course.
      if (response.reason === 'refused' && !answered) {
        absent = true;
        clearTimers();
        if (!reportedAbsent) {
          reportedAbsent = true;
          logger?.info(
            `[lmuRest] No REST API on this port; retrying in ${absentRetryMs / 1000}s`
          );
        }
        scheduleAbsentProbe();
        return;
      }

      // A failure this path uses to say something: GetGameState answers 404
      // outside a game. Handled as an answer -- no retry spent, no absence
      // reported -- and the hash is dropped, so the body that follows is read
      // even if it is the one from before.
      if (task.answerFailure?.(data, response)) {
        state.failures = 0;
        state.hash = undefined;
        if (state.reportedAbsent) {
          state.reportedAbsent = false;
          logger?.info(`[lmuRest] ${task.path} is answering`);
        }
        state.intervalMs = task.baseIntervalMs;
        schedule(task, state.intervalMs);
        return;
      }

      // A burst ends on its own clock, so a failure inside one is just a poll
      // that learned nothing. It never latches the task off: the next burst
      // is the next driver joining, and a task given up on would miss it.
      if (task.mode === 'burst') {
        continueBurst(task, false);
        return;
      }

      // An optional path is one LMU serves only in some states -- the
      // spectator camera is not readable from the main menu -- so an error
      // here is a state, not a fault. It costs no retry and never latches the
      // task off, or the feature would be dead for the whole session by the
      // time anyone used it. Backed off like an unchanged body, so an absence
      // that lasts all session is one cheap probe per ceiling.
      if (task.optional) {
        state.failures += 1;
        if (
          !state.reportedAbsent &&
          state.failures >= (task.clearAfterFailures ?? 1)
        ) {
          state.reportedAbsent = true;
          logger?.info(
            `[lmuRest] ${task.path} is not answering (${response.reason}); ` +
              'probing while the session runs'
          );
          // What it last said no longer holds. The hash goes too, or an
          // answer identical to the last one would be skipped as unchanged
          // and the cleared value would never come back.
          for (const output of task.outputs) {
            if (!output.clear) continue;
            output.clear(data);
            if (output.target === 'session') data.revision += 1;
          }
          state.hash = undefined;
        }
        state.intervalMs = backedOff(task, state.intervalMs);
        schedule(task, state.intervalMs);
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
    if (state.reportedAbsent) {
      state.reportedAbsent = false;
      logger?.info(`[lmuRest] ${task.path} is answering`);
    }
    const changed = applyBody(task, response.body);

    if (task.mode === 'burst') {
      continueBurst(task, true);
      return;
    }

    if (task.mode === 'once') {
      state.satisfied = true;
      return;
    }

    state.intervalMs = changed
      ? task.baseIntervalMs
      : backedOff(task, state.intervalMs);
    schedule(task, state.intervalMs);
  };

  const startAll = () => {
    tasks.forEach((task) => {
      const state = stateOf(task);
      // A burst task runs only when asked, but one that was asked and then
      // stalled behind the absent latch picks up where it was.
      if (task.mode === 'burst') {
        if (state.burst) schedule(task, 0);
        return;
      }
      if (state.missing || (task.mode === 'once' && state.satisfied)) return;
      // First request immediately: waiting a full interval for a pit-stop
      // estimate that is already available is a visible delay.
      schedule(task, 0);
    });
  };

  return {
    /**
     * Starts every task when LMU starts. When it stops, cancels the timers and
     * resets the tasks and the data, so the next session starts fresh.
     */
    setActive: (next: boolean) => {
      if (stopped || next === active) return;
      active = next;
      generation += 1;
      if (!active) {
        clearTimers();
        if (absentTimer !== undefined) clearTimeout(absentTimer);
        absentTimer = undefined;
        // A fresh session gets a fresh probe at the short interval.
        absent = false;
        answered = false;
        reportedAbsent = false;
        absentRetryMs = REST_ABSENT_RETRY_MS;
        resetLmuRestData(data);
        states.forEach((state) => {
          state.intervalMs = 0;
          state.hash = undefined;
          state.failures = 0;
          state.missing = false;
          state.satisfied = false;
          state.burst = undefined;
          state.lastParsed.clear();
        });
        tasks.forEach((task) => {
          stateOf(task).intervalMs = task.baseIntervalMs;
        });
        return;
      }
      startAll();
    },

    /** Re-runs the one-shot tasks, for a track or session change. */
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

    /** Starts a burst or starts it over; see LmuRestPoller.burst. */
    burst: (taskId, { delayMs, isComplete }) => {
      const task = tasks.find((candidate) => candidate.id === taskId);
      if (stopped || !active || !task || task.mode !== 'burst') return;
      const startsAt = Date.now() + delayMs;
      stateOf(task).burst = {
        isComplete,
        startsAt,
        endsAt: startsAt + (task.burstMs ?? 0),
        polls: 0,
      };
      // Replaces whatever was waiting, which is what makes a new call start
      // the burst over.
      schedule(task, delayMs);
    },

    stop: () => {
      stopped = true;
      if (absentTimer !== undefined) clearTimeout(absentTimer);
      absentTimer = undefined;
      active = false;
      clearTimers();
    },
  };
}
