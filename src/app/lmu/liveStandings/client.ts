import {
  LMU_WS_ABSENT_MAX_MS,
  LMU_WS_RECONNECT_MAX_MS,
  LMU_WS_RECONNECT_MS,
  LMU_WS_STALE_MS,
  LMU_WS_SUBSCRIBE,
  lmuWsUrl,
} from './constants';
import {
  isLmuLiveStandingsFrame,
  parseLmuLiveStandings,
  type LmuLivePenalty,
} from './penalties';

/**
 * Subscribes to LMU's `LiveStandings` topic and keeps the latest grid.
 *
 * Structured like rest/poller.ts and for the same reasons: it owns its own
 * timers, never blocks the 8 ms telemetry loop, and the loop only ever reads
 * the state it keeps. The socket is the one thing here that touches the
 * network, and it arrives injected, so a spec drives the whole lifecycle --
 * connect, subscribe, frame, staleness, drop, reconnect -- with no sockets and
 * no sim.
 *
 * What it deliberately does not do is retry forever at a fixed rate. Most
 * people run iRacing, and an LMU build that does not serve this socket must
 * cost one refused connect every so often, so the delay doubles out to a
 * ceiling and the first failure is the only one logged.
 */

export interface LmuSocketHandlers {
  readonly onOpen: () => void;
  readonly onText: (text: string) => void;
  /** Called once per connection, whether it failed to open or dropped later. */
  readonly onClose: (reason: string) => void;
}

export interface LmuSocketHandle {
  readonly send: (text: string) => void;
  readonly close: () => void;
}

/** Injected so specs drive the client with no sockets. */
export type LmuSocketFactory = (
  url: string,
  handlers: LmuSocketHandlers
) => LmuSocketHandle;

export interface LmuLiveStandingsLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
}

export interface LmuLiveStandingsOptions {
  connect: LmuSocketFactory;
  url?: string;
  logger?: LmuLiveStandingsLogger;
  /** Injected so a spec controls staleness without waiting. */
  now?: () => number;
}

export interface LmuLiveStandingsState {
  /**
   * Changes whenever the answer below would differ, including when the feed
   * goes quiet. The bridge rebuilds its per-car channel on a change and does
   * nothing on every other iteration.
   */
  readonly revision: number;
  /** The grid, or undefined when nothing is known. */
  readonly entries: ReadonlyMap<string, LmuLivePenalty> | undefined;
}

export interface LmuLiveStandingsFeed {
  /** True while LMU is running. Turning it off drops the socket and the grid. */
  setActive: (active: boolean) => void;
  /**
   * The current state, aged against `now`.
   *
   * Reading is what notices staleness, rather than a timer: the only consumer
   * already runs every 8 ms, and a timer would be a second way for the answer
   * to change.
   */
  state: () => LmuLiveStandingsState;
  stop: () => void;
}

export const createLmuLiveStandings = ({
  connect,
  url = lmuWsUrl(),
  logger,
  now = () => Date.now(),
}: LmuLiveStandingsOptions): LmuLiveStandingsFeed => {
  let active = false;
  let stopped = false;
  let socket: LmuSocketHandle | undefined;
  /**
   * Identifies the connection a callback belongs to.
   *
   * `ws` can emit an error and a close for the same socket, and a socket
   * closed by setActive(false) can still deliver a callback afterwards. Both
   * would otherwise schedule a reconnect for a connection nobody is waiting
   * on any more.
   */
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reconnectMs = LMU_WS_RECONNECT_MS;
  /** So a build without this socket logs once rather than once per attempt. */
  let reportedFailure = false;
  let everConnected = false;

  let revision = 0;
  let entries: ReadonlyMap<string, LmuLivePenalty> | undefined;
  let lastFrameAt = Number.NEGATIVE_INFINITY;

  const forget = () => {
    if (entries === undefined) return;
    entries = undefined;
    revision += 1;
  };

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  const scheduleReconnect = () => {
    clearTimer();
    if (!active || stopped) return;
    const delay = reconnectMs;
    // A socket that has worked before is worth chasing harder than one that
    // has never answered at all. See the ceilings in constants.ts.
    const ceiling = everConnected
      ? LMU_WS_RECONNECT_MAX_MS
      : LMU_WS_ABSENT_MAX_MS;
    reconnectMs = Math.min(reconnectMs * 2, ceiling);
    timer = setTimeout(open, delay);
  };

  const closeCurrent = () => {
    generation += 1;
    const handle = socket;
    socket = undefined;
    if (!handle) return;
    try {
      handle.close();
    } catch {
      // A socket that throws on close is already gone, which is the state
      // this was asking for.
    }
  };

  function open(): void {
    clearTimer();
    if (!active || stopped || socket) return;

    const mine = generation;
    /**
     * Set when the socket opened before `connect` had returned its handle.
     *
     * `ws` opens asynchronously, so in practice there is a handle to send on
     * by the time this fires. A factory that opens synchronously would
     * otherwise connect and never subscribe, which is a silent feed.
     */
    let subscribePending = false;

    const subscribe = () => {
      try {
        socket?.send(LMU_WS_SUBSCRIBE);
      } catch (error) {
        logger?.warn(`[lmuLiveStandings] Subscribe failed: ${String(error)}`);
      }
    };

    const handlers: LmuSocketHandlers = {
      onOpen: () => {
        if (mine !== generation) return;
        everConnected = true;
        reconnectMs = LMU_WS_RECONNECT_MS;
        if (reportedFailure) {
          reportedFailure = false;
          logger?.info(`[lmuLiveStandings] Reconnected to ${url}`);
        }
        if (socket) subscribe();
        else subscribePending = true;
      },
      onText: (text) => {
        if (mine !== generation) return;
        const frame = parseLmuLiveStandings(text);
        if (!frame || !isLmuLiveStandingsFrame(frame)) return;

        // Replaced wholesale, never merged: the frame is the whole grid, so a
        // car it no longer mentions has served its penalty. Merging would
        // leave the badge up for the rest of the session.
        entries = frame.entries;
        lastFrameAt = now();
        revision += 1;
      },
      onClose: (reason) => {
        if (mine !== generation) return;
        // Retires this connection before anything else, so a second close --
        // `ws` emits one after an error, and a dying socket can emit more --
        // cannot schedule a second reconnect for the same drop.
        generation += 1;
        socket = undefined;
        forget();
        if (!active || stopped) return;
        if (!reportedFailure) {
          reportedFailure = true;
          logger?.[everConnected ? 'info' : 'warn'](
            everConnected
              ? `[lmuLiveStandings] Socket dropped (${reason}); reconnecting`
              : `[lmuLiveStandings] No penalty feed at ${url} (${reason}); ` +
                  'penalty kinds will fall back to the player-only estimate'
          );
        }
        scheduleReconnect();
      },
    };

    try {
      socket = connect(url, handlers);
      if (subscribePending) subscribe();
    } catch (error) {
      socket = undefined;
      handlers.onClose(String(error));
    }
  }

  return {
    setActive: (next) => {
      if (stopped || next === active) return;
      active = next;
      if (active) {
        reconnectMs = LMU_WS_RECONNECT_MS;
        open();
      } else {
        clearTimer();
        closeCurrent();
        forget();
      }
    },
    state: () => {
      if (entries !== undefined && now() - lastFrameAt > LMU_WS_STALE_MS) {
        forget();
      }
      return { revision, entries };
    },
    stop: () => {
      stopped = true;
      active = false;
      clearTimer();
      closeCurrent();
      forget();
    },
  };
};
