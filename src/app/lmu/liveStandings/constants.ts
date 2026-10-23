/**
 * LMU's UI websocket, which is where a penalty's *kind* comes from.
 *
 * Shared memory counts penalties (`mNumPenalties`) and says nothing about what
 * they are, and `/rest/strategy/pitstop-estimate` gives only the seconds the
 * player's own next stop will spend serving them. Neither names a kind, and
 * neither says anything at all about another car.
 *
 * The sim's own UI is fed by a websocket that does: subscribing to its
 * `LiveStandings` topic yields one entry per car carrying `penalties` broken
 * out by kind. doX's plugin reads exactly this -- its `LmuLiveStandingsPenalty`
 * contract is `{ DT, SG, TIME }` per entry, and its `IsDriveThroughPenalty` /
 * `IsStopGoPenalty` / `IsTimePenalty` are plain string compares against
 * constants it wrote itself one step earlier, so nothing in its chain infers a
 * kind from a duration. The same frame also carries the track-limits
 * allowance, which is where its `TrackLimitsPointsAllowed` comes from.
 *
 * 127.0.0.1 rather than localhost, for the reason LMU_REST_ORIGIN gives: on
 * Windows localhost can resolve IPv6-first and stall before falling back.
 */
export const LMU_WS_URL = 'ws://127.0.0.1:6398/websocket/ui';

/** The socket to subscribe to, overridable for debugging against another host. */
export const lmuWsUrl = (): string =>
  process.env.IRDASHIES_LMU_WS_URL?.trim() || LMU_WS_URL;

/** The topic carrying the grid, and the subscribe frame that asks for it. */
export const LMU_WS_TOPIC = 'LiveStandings';

export const LMU_WS_SUBSCRIBE = JSON.stringify({
  messageType: 'SUB',
  topic: LMU_WS_TOPIC,
});

/**
 * How long a frame stays trustworthy.
 *
 * The socket pushes the whole grid, so a penalty disappearing from a frame is
 * how the feed says it has been served. If the socket dies instead, the last
 * frame it sent would otherwise hold a red badge on screen for the rest of the
 * session. After this long with nothing arriving the feed reports nothing
 * known, and the badges fall back to the player-only estimate.
 *
 * Generous rather than tight, because the push rate is the sim's to choose and
 * a quiet grid may simply have nothing to report.
 */
export const LMU_WS_STALE_MS = 15_000;

/**
 * Reconnect delay, and the two ceilings it doubles up to.
 *
 * Retried indefinitely rather than a fixed number of times, because there is
 * no attempt count at which "the sim is not serving this" becomes true: the
 * socket is a server inside LMU and its port need not be open at the moment
 * the app first reaches shared memory. Giving up after n tries would turn a
 * slow start into a session with no penalty kinds.
 *
 * What bounds the cost is the delay, and which ceiling applies depends on
 * whether the socket has ever answered -- the same shape as the REST absent
 * latch in rest/constants.ts, for the same reason:
 *
 * - It has worked before, so a drop is probably transient: out to a minute.
 * - It has never worked, so this build probably does not serve it: out to
 *   five minutes, which is one refused loopback connect per five minutes for
 *   the rest of the session. A failed connect to a closed local port is
 *   immediate and allocates nothing that outlives it.
 *
 * Either way a sim that is merely slow to open the port is picked up within a
 * couple of seconds, because the first few retries are fast.
 */
export const LMU_WS_RECONNECT_MS = 2000;
export const LMU_WS_RECONNECT_MAX_MS = 60_000;
export const LMU_WS_ABSENT_MAX_MS = 300_000;
