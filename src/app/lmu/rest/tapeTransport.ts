import type { LmuRestResponse, LmuRestTransport } from './poller';

/** The slice of the replay addon this needs. */
export interface LmuTapeRestSource {
  /** The latest recorded body for a path, or null if the tape has none. */
  readRest: (path: string) => string | null;
}

/**
 * The key the recorder wraps a failed request in, for the one path whose
 * failures are answers (GetGameState). Must match kRestFailureKey in
 * native/replay/lmu_replay_main.cpp; rest/recorderParity.spec.ts checks it.
 */
export const TAPE_REST_FAILURE_KEY = 'irdashiesRestFailure';

const FAILURE_PREFIX = `{"${TAPE_REST_FAILURE_KEY}"`;

/**
 * A recorded failure, as the failure it was, or undefined for a body that is
 * not one -- a prefix test first, so an ordinary body costs no parse.
 */
const recordedFailure = (body: string): LmuRestResponse | undefined => {
  if (!body.startsWith(FAILURE_PREFIX)) return undefined;
  try {
    const failure = (JSON.parse(body) as Record<string, unknown>)[
      TAPE_REST_FAILURE_KEY
    ] as Record<string, unknown> | undefined;
    if (failure?.reason === 'refused') return { ok: false, reason: 'refused' };
    if (failure?.reason === 'status') {
      return {
        ok: false,
        reason: 'status',
        status: typeof failure.status === 'number' ? failure.status : undefined,
        body: typeof failure.body === 'string' ? failure.body : '',
      };
    }
  } catch {
    // Not one after all; served as the body it is.
  }
  return undefined;
};

/**
 * Serves REST responses from a tape instead of over HTTP.
 *
 * The transport is an injected function precisely so the source can be
 * swapped, so the poller is unchanged by this: it still hashes bodies, skips
 * unchanged ones and backs off, which means a replay exercises the same code
 * path a live session does rather than a shortcut around it.
 *
 * A path the tape has nothing for yet answers `pending` rather than a
 * failure. REST records are interleaved with snapshots, so early in playback a
 * path legitimately has no body, and treating that as a failure would latch
 * the task off seconds into every replay. A path the recording never covered
 * simply stays pending for the whole run, which is the honest answer -- it was
 * never captured.
 *
 * A recorded failure is served as that failure, so GetGameState's 404 and
 * `unavailable` answers, and the sim going away, replay as they happened.
 */
export function createLmuTapeRestTransport(
  source: LmuTapeRestSource
): LmuRestTransport {
  return (path: string): Promise<LmuRestResponse> => {
    let body: string | null;
    try {
      body = source.readRest(path);
    } catch {
      // A tape that cannot be read is not something to retry around; the
      // snapshot path will be reporting the same trouble far more loudly.
      return Promise.resolve({ ok: false, reason: 'network' });
    }
    if (body === null) return Promise.resolve({ ok: false, reason: 'pending' });
    return Promise.resolve(recordedFailure(body) ?? { ok: true, body });
  };
}
