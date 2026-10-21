import type { LmuRestResponse, LmuRestTransport } from './poller';

/** The slice of the replay addon this needs. */
export interface LmuTapeRestSource {
  /** The latest recorded body for a path, or null if the tape has none. */
  readRest: (path: string) => string | null;
}

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
    return Promise.resolve(
      body === null ? { ok: false, reason: 'pending' } : { ok: true, body }
    );
  };
}
