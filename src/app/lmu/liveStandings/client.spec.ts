import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLmuLiveStandings, type LmuSocketHandlers } from './client';
import {
  LMU_WS_ABSENT_MAX_MS,
  LMU_WS_RECONNECT_MAX_MS,
  LMU_WS_RECONNECT_MS,
  LMU_WS_STALE_MS,
  LMU_WS_SUBSCRIBE,
} from './constants';

/** A socket a spec drives: no network, every callback fired by hand. */
const harness = () => {
  const opened: string[] = [];
  const sent: string[] = [];
  let closes = 0;
  let live: LmuSocketHandlers | undefined;
  let last: LmuSocketHandlers | undefined;
  let throwOnConnect: string | undefined;
  let openEagerly = false;

  return {
    opened,
    sent,
    get closes() {
      return closes;
    },
    get connected() {
      return live !== undefined;
    },
    failConnect: (message: string) => {
      throwOnConnect = message;
    },
    open: () => live?.onOpen(),
    text: (text: string) => live?.onText(text),
    drop: (reason = 'code 1006') => {
      const handlers = live;
      live = undefined;
      handlers?.onClose(reason);
    },
    /** Fires a callback the client should have retired. */
    stale: (reason = 'code 1006') => last?.onClose(reason),
    /** A factory that opens during connect, as a synchronous one would. */
    openDuringConnect: () => {
      openEagerly = true;
    },
    connect: (url: string, handlers: LmuSocketHandlers) => {
      opened.push(url);
      if (throwOnConnect) {
        const message = throwOnConnect;
        throwOnConnect = undefined;
        throw new Error(message);
      }
      live = handlers;
      last = handlers;
      if (openEagerly) handlers.onOpen();
      return {
        send: (text: string) => sent.push(text),
        close: () => {
          closes += 1;
          live = undefined;
        },
      };
    },
  };
};

const frame = (name: string, penalties: Record<string, number>) =>
  JSON.stringify({
    topic: 'LiveStandings',
    entries: [{ driverName: name, position: 1, penalties }],
  });

let clock = 0;
const now = () => clock;

const feedWith = (socket: ReturnType<typeof harness>) =>
  createLmuLiveStandings({
    connect: socket.connect,
    url: 'ws://test/websocket/ui',
    now,
  });

beforeEach(() => {
  vi.useFakeTimers();
  clock = 1_000_000;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createLmuLiveStandings', () => {
  it('connects and subscribes only once activated', () => {
    const socket = harness();
    const feed = feedWith(socket);
    expect(socket.opened).toEqual([]);

    feed.setActive(true);
    expect(socket.opened).toEqual(['ws://test/websocket/ui']);
    socket.open();
    expect(socket.sent).toEqual([LMU_WS_SUBSCRIBE]);
  });

  it('keeps the grid from a frame and bumps the revision', () => {
    const socket = harness();
    const feed = feedWith(socket);
    feed.setActive(true);
    socket.open();

    const before = feed.state().revision;
    socket.text(frame('Alice', { DT: 1 }));
    const after = feed.state();

    expect(after.revision).not.toBe(before);
    expect(after.entries?.get('alice')).toEqual({
      driveThrough: 1,
      stopGo: 0,
      timeSeconds: 0,
    });
  });

  it('replaces the grid rather than merging it', () => {
    // The frame is the whole grid, so a car it stops mentioning has served
    // its penalty. Merging would hold the badge up for the session.
    const socket = harness();
    const feed = feedWith(socket);
    feed.setActive(true);
    socket.open();

    socket.text(frame('Alice', { DT: 1 }));
    socket.text(frame('Bob', { SG: 1 }));

    expect(feed.state().entries?.has('alice')).toBe(false);
    expect(feed.state().entries?.get('bob')?.stopGo).toBe(1);
  });

  it('ignores a frame about another topic', () => {
    const socket = harness();
    const feed = feedWith(socket);
    feed.setActive(true);
    socket.open();
    socket.text(frame('Alice', { DT: 1 }));
    const held = feed.state().revision;

    socket.text(
      JSON.stringify({
        topic: 'Chat',
        entries: [{ driverName: 'Bob', position: 1 }],
      })
    );

    expect(feed.state().revision).toBe(held);
    expect(feed.state().entries?.get('alice')?.driveThrough).toBe(1);
  });

  it('ignores a frame it cannot read', () => {
    const socket = harness();
    const feed = feedWith(socket);
    feed.setActive(true);
    socket.open();
    socket.text(frame('Alice', { DT: 1 }));
    const held = feed.state().revision;

    socket.text('<html>not json</html>');

    expect(feed.state().revision).toBe(held);
    expect(feed.state().entries?.get('alice')?.driveThrough).toBe(1);
  });

  it('forgets the grid once the feed goes quiet', () => {
    // Otherwise a dead socket's last frame holds a red badge on screen for
    // the rest of the session.
    const socket = harness();
    const feed = feedWith(socket);
    feed.setActive(true);
    socket.open();
    socket.text(frame('Alice', { DT: 1 }));
    const fresh = feed.state().revision;

    clock += LMU_WS_STALE_MS + 1;
    const stale = feed.state();

    expect(stale.entries).toBeUndefined();
    expect(stale.revision).not.toBe(fresh);
    // And settles: a second read reports the same thing.
    expect(feed.state().revision).toBe(stale.revision);
  });

  it('keeps the grid while frames keep arriving', () => {
    const socket = harness();
    const feed = feedWith(socket);
    feed.setActive(true);
    socket.open();

    for (let i = 0; i < 5; i += 1) {
      clock += LMU_WS_STALE_MS - 1;
      socket.text(frame('Alice', { DT: 1 }));
      expect(feed.state().entries?.has('alice')).toBe(true);
    }
  });

  it('reconnects on a drop, backing off as it keeps failing', () => {
    const socket = harness();
    const feed = feedWith(socket);
    feed.setActive(true);
    socket.open();
    socket.drop();

    expect(socket.opened).toHaveLength(1);
    vi.advanceTimersByTime(LMU_WS_RECONNECT_MS);
    expect(socket.opened).toHaveLength(2);

    socket.drop();
    // Doubled, so the next attempt is not at the first delay any more.
    vi.advanceTimersByTime(LMU_WS_RECONNECT_MS);
    expect(socket.opened).toHaveLength(2);
    vi.advanceTimersByTime(LMU_WS_RECONNECT_MS);
    expect(socket.opened).toHaveLength(3);
  });

  it('resets the backoff once a frame arrives again', () => {
    const socket = harness();
    const feed = feedWith(socket);
    feed.setActive(true);
    socket.open();
    socket.drop();
    vi.advanceTimersByTime(LMU_WS_RECONNECT_MS);
    socket.open();
    socket.drop();

    vi.advanceTimersByTime(LMU_WS_RECONNECT_MS);
    expect(socket.opened).toHaveLength(3);
  });

  it('survives a connect that throws', () => {
    const socket = harness();
    const feed = feedWith(socket);
    socket.failConnect('EADDRNOTAVAIL');

    expect(() => feed.setActive(true)).not.toThrow();
    vi.advanceTimersByTime(LMU_WS_RECONNECT_MS);
    expect(socket.opened).toHaveLength(2);
  });

  it('drops the socket and the grid when LMU goes away', () => {
    const socket = harness();
    const feed = feedWith(socket);
    feed.setActive(true);
    socket.open();
    socket.text(frame('Alice', { DT: 1 }));

    feed.setActive(false);

    expect(socket.closes).toBe(1);
    expect(feed.state().entries).toBeUndefined();
    // And no reconnect is pending for a sim that is not running.
    vi.advanceTimersByTime(LMU_WS_RECONNECT_MS * 10);
    expect(socket.opened).toHaveLength(1);
  });

  it('stays stopped once stopped', () => {
    const socket = harness();
    const feed = feedWith(socket);
    feed.setActive(true);
    socket.open();

    feed.stop();
    feed.setActive(true);

    vi.advanceTimersByTime(LMU_WS_RECONNECT_MS * 10);
    expect(socket.opened).toHaveLength(1);
    expect(socket.connected).toBe(false);
  });

  it('ignores a close from a connection it already retired', () => {
    // `ws` emits an error and then a close for the same socket. Two closes
    // for one drop would otherwise schedule two reconnects, and the delay
    // would double twice per failure.
    const socket = harness();
    const feed = feedWith(socket);
    feed.setActive(true);
    socket.open();
    socket.drop();
    socket.stale();

    vi.advanceTimersByTime(LMU_WS_RECONNECT_MS);
    expect(socket.opened).toHaveLength(2);
  });

  it('ignores a close from a socket closed because LMU went away', () => {
    const socket = harness();
    const feed = feedWith(socket);
    feed.setActive(true);
    feed.setActive(false);

    socket.stale();
    vi.advanceTimersByTime(LMU_WS_RECONNECT_MS * 10);
    expect(socket.opened).toHaveLength(1);
  });

  it('subscribes even when the socket opens during connect', () => {
    // A silent feed otherwise: connected, never subscribed.
    const socket = harness();
    const feed = feedWith(socket);
    socket.openDuringConnect();
    feed.setActive(true);
    expect(socket.sent).toEqual([LMU_WS_SUBSCRIBE]);
  });
});

describe('createLmuLiveStandings with a socket that never answers', () => {
  /** Fails every connect, as a build that does not serve this socket would. */
  const deadHarness = () => {
    const socket = harness();
    const connect = (url: string, handlers: LmuSocketHandlers) => {
      socket.opened.push(url);
      // ws emits an error and then a close for a refused connection.
      setTimeout(() => handlers.onClose('ECONNREFUSED'), 0);
      return { send: () => undefined, close: () => undefined };
    };
    return { socket, connect };
  };

  const run = () => {
    const { socket, connect } = deadHarness();
    const feed = createLmuLiveStandings({
      connect,
      url: 'ws://test/websocket/ui',
      now,
    });
    feed.setActive(true);
    return { socket, feed };
  };

  it('keeps retrying rather than giving up after n attempts', () => {
    // There is no attempt count at which "the sim is not serving this"
    // becomes true -- the port need not be open when the app starts.
    const { socket } = run();
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(socket.opened.length).toBeGreaterThan(5);
  });

  it('settles at the absent ceiling, not the drop ceiling', () => {
    const { socket } = run();
    vi.advanceTimersByTime(60 * 60 * 1000);
    const settled = socket.opened.length;

    // One drop-ceiling interval buys nothing more once it has backed off.
    vi.advanceTimersByTime(LMU_WS_RECONNECT_MAX_MS);
    expect(socket.opened).toHaveLength(settled);

    vi.advanceTimersByTime(LMU_WS_ABSENT_MAX_MS);
    expect(socket.opened).toHaveLength(settled + 1);
  });

  it('still picks up a socket that was merely slow to open', () => {
    // The first retries are fast, so a port that opens a few seconds late
    // is not punished by the long ceiling.
    const { socket } = run();
    vi.advanceTimersByTime(10_000);
    expect(socket.opened.length).toBeGreaterThanOrEqual(3);
  });

  it('reports nothing known, which is what the fallback needs', () => {
    const { feed } = run();
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(feed.state().entries).toBeUndefined();
  });

  it('never throws, and leaves no timer once LMU goes away', () => {
    const { feed, socket } = run();
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(() => feed.setActive(false)).not.toThrow();

    const settled = socket.opened.length;
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(socket.opened).toHaveLength(settled);
    expect(vi.getTimerCount()).toBe(0);
  });
});
