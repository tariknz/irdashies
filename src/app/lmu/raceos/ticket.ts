import type { LmuRestTransport } from '../rest/poller';

/**
 * Asks LMU for a Steam auth session ticket.
 *
 * The sim mints this for the signed-in user on request; it is what the
 * rating service accepts in place of an API key. Short-lived by design, so
 * it is fetched when a token is needed rather than cached here -- the token
 * it buys is the thing worth holding on to (see client.ts).
 *
 * Reuses the same loopback transport as the REST poller, so a tape replay
 * reads the recorded response rather than hitting a port no sim is serving.
 *
 * Returns undefined for every failure. The sim not running, not being signed
 * in, or serving a build without this endpoint are all ordinary states, and
 * none of them should read as an error.
 */
export const AUTH_TICKET_PATH = '/rest/profile/getAuthSessionTicket';

/** A plausible ticket: non-empty, and not an error page or an empty JSON body. */
const isTicket = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export function createTicketFetcher(
  transport: LmuRestTransport
): () => Promise<string | undefined> {
  return async () => {
    const response = await transport(AUTH_TICKET_PATH);
    if (!response.ok) return undefined;

    const body = response.body.trim();
    if (!body) return undefined;

    // The endpoint has been seen answering with a bare quoted string and
    // with an object wrapping it, so both are accepted rather than betting
    // on one. A bare unquoted token is accepted too: it parses as neither.
    try {
      const payload: unknown = JSON.parse(body);
      if (isTicket(payload)) return payload;
      if (payload && typeof payload === 'object') {
        const record = payload as Record<string, unknown>;
        for (const key of ['ticket', 'authSessionTicket', 'token']) {
          if (isTicket(record[key])) return record[key] as string;
        }
      }
      return undefined;
    } catch {
      return isTicket(body) ? body : undefined;
    }
  };
}
