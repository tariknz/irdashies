import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLmuRestPoller,
  type LmuRestResponse,
  type LmuRestTransport,
} from './poller';
import { createLmuRestData, type LmuRestData } from './state';
import type { LmuRestTask } from './tasks';
import {
  REST_MAX_INTERVAL_MS,
  REST_RETRY_DELAY_MS,
  REST_RETRY_LIMIT,
} from './constants';

const BASE_MS = 1000;

/** A repeating task whose parser we can watch, to prove parsing is skipped. */
const parseSpy = vi.fn((payload: unknown) =>
  typeof payload === 'object' && payload !== null
    ? (payload as { total?: number }).total
    : undefined
);
const applySpy = vi.fn((data: LmuRestData, value: unknown) => {
  data.cells.pitStopTime = { value: [value as number] };
});

const repeatTask: LmuRestTask = {
  id: 'repeat',
  path: '/rest/strategy/pitstop-estimate',
  mode: 'repeat',
  baseIntervalMs: BASE_MS,
  outputs: [
    {
      id: 'pitStopTime',
      target: 'telemetry',
      parse: parseSpy,
      apply: applySpy,
    },
  ],
};

const sessionTask: LmuRestTask = {
  id: 'once',
  path: '/rest/sessions',
  mode: 'once',
  baseIntervalMs: BASE_MS,
  outputs: [
    {
      id: 'timeScale',
      target: 'session',
      parse: (payload) =>
        typeof payload === 'object' && payload !== null
          ? (payload as { scale?: number }).scale
          : undefined,
      apply: (data, value) => {
        data.session.timeScale = value as number;
      },
    },
  ],
};

const ok = (body: string): LmuRestResponse => ({ ok: true, body });
const fail = (reason: 'refused' | 'timeout'): LmuRestResponse => ({
  ok: false,
  reason,
});

/** Lets each test queue what the next request returns, per path. */
const makeTransport = (
  responder: (path: string) => LmuRestResponse
): { transport: LmuRestTransport; calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    transport: (path) => {
      calls.push(path);
      return Promise.resolve(responder(path));
    },
  };
};

/**
 * Flushes the microtasks an awaited transport resolves through.
 *
 * Not enough on its own to start the first request: activation schedules it
 * with setTimeout(0), so a timer tick is needed too -- hence `advance(0)` after
 * setActive/invalidateOnce rather than a bare settle.
 */
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const advance = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
  await settle();
};

describe('createLmuRestPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    parseSpy.mockClear();
    applySpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing until activated', async () => {
    const { transport, calls } = makeTransport(() => ok('{"total":30}'));
    createLmuRestPoller({
      data: createLmuRestData(),
      transport,
      tasks: [repeatTask],
    });

    await advance(10_000);

    expect(calls).toEqual([]);
  });

  it('requests immediately on activation rather than after an interval', async () => {
    const data = createLmuRestData();
    const { transport, calls } = makeTransport(() => ok('{"total":30}'));
    const poller = createLmuRestPoller({
      data,
      transport,
      tasks: [repeatTask],
    });

    poller.setActive(true);
    await advance(0);

    expect(calls).toEqual(['/rest/strategy/pitstop-estimate']);
    expect(data.cells.pitStopTime?.value[0]).toBe(30);
  });

  it('skips parsing entirely when the body is unchanged', async () => {
    // The whole point of the hash compare: an unchanged payload must cost one
    // hash pass, not a JSON.parse and a run through every parser.
    const { transport } = makeTransport(() => ok('{"total":30}'));
    const poller = createLmuRestPoller({
      data: createLmuRestData(),
      transport,
      tasks: [repeatTask],
    });

    poller.setActive(true);
    await advance(0);
    expect(parseSpy).toHaveBeenCalledTimes(1);

    await advance(BASE_MS * 20);

    // Many more requests happened, but no further parsing.
    expect(parseSpy).toHaveBeenCalledTimes(1);
  });

  it('backs off geometrically while the body is unchanged, up to the cap', async () => {
    const { transport, calls } = makeTransport(() => ok('{"total":30}'));
    const poller = createLmuRestPoller({
      data: createLmuRestData(),
      transport,
      tasks: [repeatTask],
    });

    poller.setActive(true);
    await advance(0);
    expect(calls).toHaveLength(1);

    // 1000 -> 1500 -> 2250 -> 3375 -> 5000 (capped)
    await advance(1000);
    expect(calls).toHaveLength(2);
    await advance(1499);
    expect(calls).toHaveLength(2); // not due yet
    await advance(1);
    expect(calls).toHaveLength(3);
    await advance(2250);
    expect(calls).toHaveLength(4);
    await advance(3375);
    expect(calls).toHaveLength(5);

    // From here every further request is one cap-interval apart.
    await advance(REST_MAX_INTERVAL_MS);
    expect(calls).toHaveLength(6);
    await advance(REST_MAX_INTERVAL_MS - 1);
    expect(calls).toHaveLength(6);
  });

  it('returns to the base interval the moment the body changes', async () => {
    let total = 30;
    const { transport, calls } = makeTransport(() => ok(`{"total":${total}}`));
    const poller = createLmuRestPoller({
      data: createLmuRestData(),
      transport,
      tasks: [repeatTask],
    });

    poller.setActive(true);
    await advance(0);
    // Let it back off well past the base interval.
    await advance(1000);
    await advance(1500);
    await advance(2250);
    const backedOff = calls.length;

    total = 45;
    await advance(3375);
    expect(calls).toHaveLength(backedOff + 1);

    // Base interval again, not the backed-off one.
    await advance(BASE_MS);
    expect(calls).toHaveLength(backedOff + 2);
  });

  it('runs a one-shot task exactly once per activation', async () => {
    const data = createLmuRestData();
    const { transport, calls } = makeTransport(() => ok('{"scale":6}'));
    const poller = createLmuRestPoller({
      data,
      transport,
      tasks: [sessionTask],
    });

    poller.setActive(true);
    await advance(0);
    await advance(60_000);

    expect(calls).toEqual(['/rest/sessions']);
    expect(data.session.timeScale).toBe(6);
  });

  it('bumps the revision for a session value but not a telemetry one', async () => {
    // This is what the bridge watches to force a session republish, so a
    // telemetry-only change must not trigger a full session rebuild.
    const data = createLmuRestData();
    const { transport } = makeTransport((path) =>
      path === '/rest/sessions' ? ok('{"scale":6}') : ok('{"total":30}')
    );
    const poller = createLmuRestPoller({
      data,
      transport,
      tasks: [repeatTask],
    });

    poller.setActive(true);
    await advance(0);
    expect(data.cells.pitStopTime?.value[0]).toBe(30);
    expect(data.revision).toBe(0);

    poller.stop();

    const sessionData = createLmuRestData();
    const sessionPoller = createLmuRestPoller({
      data: sessionData,
      transport,
      tasks: [sessionTask],
    });
    sessionPoller.setActive(true);
    await advance(0);

    expect(sessionData.revision).toBe(1);
  });

  it('re-runs one-shot tasks on invalidateOnce, leaving repeats alone', async () => {
    const { transport, calls } = makeTransport((path) =>
      path === '/rest/sessions' ? ok('{"scale":6}') : ok('{"total":30}')
    );
    const poller = createLmuRestPoller({
      data: createLmuRestData(),
      transport,
      tasks: [sessionTask, repeatTask],
    });

    poller.setActive(true);
    await advance(0);
    const before = calls.filter((p) => p === '/rest/sessions').length;
    expect(before).toBe(1);

    poller.invalidateOnce();
    await advance(0);

    expect(calls.filter((p) => p === '/rest/sessions')).toHaveLength(2);
  });

  it('retries a failing task, then gives up and logs once', async () => {
    const logger = { info: vi.fn(), warn: vi.fn() };
    // Timeout rather than refused: a refusal on a first request means the whole
    // API is absent, which is a different path.
    const { transport, calls } = makeTransport(() => fail('timeout'));
    const poller = createLmuRestPoller({
      data: createLmuRestData(),
      transport,
      logger,
      tasks: [repeatTask],
    });

    poller.setActive(true);
    await advance(0);
    for (let i = 0; i < REST_RETRY_LIMIT; i++) {
      await advance(REST_RETRY_DELAY_MS);
    }
    const afterGivingUp = calls.length;

    expect(afterGivingUp).toBe(REST_RETRY_LIMIT);
    expect(logger.warn).toHaveBeenCalledTimes(1);

    // Latched off: no further requests however long we wait.
    await advance(60_000);
    expect(calls).toHaveLength(afterGivingUp);
  });

  it('treats a refusal on the first request as the API being absent', async () => {
    // An older LMU has no REST API. That must cost one failed connect for the
    // whole poller, not three per task.
    const logger = { info: vi.fn(), warn: vi.fn() };
    const { transport, calls } = makeTransport(() => fail('refused'));
    const poller = createLmuRestPoller({
      data: createLmuRestData(),
      transport,
      logger,
      tasks: [repeatTask, sessionTask],
    });

    poller.setActive(true);
    await advance(0);
    await advance(60_000);

    expect(calls.length).toBeLessThanOrEqual(2);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not re-probe an absent API on the next activation', async () => {
    const { transport, calls } = makeTransport(() => fail('refused'));
    const poller = createLmuRestPoller({
      data: createLmuRestData(),
      transport,
      tasks: [repeatTask],
    });

    poller.setActive(true);
    await advance(0);
    const probes = calls.length;

    poller.setActive(false);
    poller.setActive(true);
    await advance(60_000);

    expect(calls).toHaveLength(probes);
  });

  it('clears the data and publishes the clear when deactivated', async () => {
    const data = createLmuRestData();
    const { transport } = makeTransport((path) =>
      path === '/rest/sessions' ? ok('{"scale":6}') : ok('{"total":30}')
    );
    const poller = createLmuRestPoller({
      data,
      transport,
      tasks: [repeatTask, sessionTask],
    });

    poller.setActive(true);
    await advance(0);
    expect(data.cells.pitStopTime).toBeDefined();
    const revisionWhenPopulated = data.revision;

    poller.setActive(false);

    expect(data.cells).toEqual({});
    expect(data.session).toEqual({});
    // A stale estimate left on screen reads as current, so the clear has to
    // reach the renderer too.
    expect(data.revision).toBeGreaterThan(revisionWhenPopulated);
  });

  it('stops requesting after stop()', async () => {
    const { transport, calls } = makeTransport(() => ok('{"total":30}'));
    const poller = createLmuRestPoller({
      data: createLmuRestData(),
      transport,
      tasks: [repeatTask],
    });

    poller.setActive(true);
    await advance(0);
    const before = calls.length;

    poller.stop();
    await advance(60_000);

    expect(calls).toHaveLength(before);
  });

  it('survives a transport that rejects instead of resolving', async () => {
    // The contract says resolve, but an unhandled rejection here would kill the
    // chain silently.
    const calls: string[] = [];
    const transport: LmuRestTransport = (path) => {
      calls.push(path);
      return Promise.reject(new Error('boom'));
    };
    const poller = createLmuRestPoller({
      data: createLmuRestData(),
      transport,
      tasks: [repeatTask],
    });

    poller.setActive(true);
    await advance(0);
    await advance(REST_RETRY_DELAY_MS);

    expect(calls.length).toBeGreaterThan(0);
    expect(() => poller.stop()).not.toThrow();
  });

  it('keeps a non-JSON body from being re-parsed every interval', async () => {
    const { transport } = makeTransport(() => ok('<html>nope</html>'));
    const poller = createLmuRestPoller({
      data: createLmuRestData(),
      transport,
      tasks: [repeatTask],
    });

    poller.setActive(true);
    await advance(0);
    await advance(BASE_MS * 10);

    // Never parsed successfully, so never applied -- and the hash is retained,
    // so the body is not decoded again.
    expect(applySpy).not.toHaveBeenCalled();
  });
});

describe('createLmuRestPoller with a pending source', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    parseSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps retrying a pending path without spending a retry', async () => {
    // What a tape does early in playback: the path is real, the record has
    // simply not gone by yet. Three of these must not latch the task off.
    const { transport, calls } = makeTransport(() => ({
      ok: false,
      reason: 'pending' as const,
    }));
    const poller = createLmuRestPoller({
      data: createLmuRestData(),
      transport,
      tasks: [repeatTask],
    });

    poller.setActive(true);
    await advance(0);
    for (let i = 0; i < 10; i++) await advance(BASE_MS);

    // Still asking, well past the retry limit.
    expect(calls.length).toBeGreaterThan(REST_RETRY_LIMIT + 5);
  });

  it('retries a pending path at the base interval, not a backed-off one', async () => {
    const { transport, calls } = makeTransport(() => ({
      ok: false,
      reason: 'pending' as const,
    }));
    const poller = createLmuRestPoller({
      data: createLmuRestData(),
      transport,
      tasks: [repeatTask],
    });

    poller.setActive(true);
    await advance(0);
    const first = calls.length;

    await advance(BASE_MS);
    expect(calls).toHaveLength(first + 1);
    await advance(BASE_MS);
    expect(calls).toHaveLength(first + 2);
  });

  it('starts serving as soon as the tape produces a body', async () => {
    let body: string | null = null;
    const { transport } = makeTransport(() =>
      body === null
        ? { ok: false, reason: 'pending' as const }
        : { ok: true, body }
    );
    const data = createLmuRestData();
    const poller = createLmuRestPoller({
      data,
      transport,
      tasks: [repeatTask],
    });

    poller.setActive(true);
    await advance(0);
    expect(data.cells.pitStopTime).toBeUndefined();

    body = '{"total":41}';
    await advance(BASE_MS);

    expect(data.cells.pitStopTime?.value[0]).toBe(41);
  });
});
