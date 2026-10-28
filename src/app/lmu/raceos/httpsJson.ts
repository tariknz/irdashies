import https from 'node:https';

/**
 * The only outbound-internet IO in the LMU rating feature.
 *
 * Built on `node:https` directly for the same reason `lmu/rest/httpJson.ts`
 * is built on `node:http`: there is no HTTP client dependency in this app and
 * one rating lookup is not a good enough reason to add one.
 *
 * Unlike the loopback transport this one really can be slow -- it crosses the
 * internet -- so the timeout is generous and the caller is expected to treat
 * every failure as "no rating this time" rather than retrying hard. Returns a
 * result instead of throwing so no caller has to reason about exception types.
 */

/** Generous: this is a background enrichment, never on a render path. */
export const RACEOS_TIMEOUT_MS = 8000;

export type RaceosResponse =
  | { ok: true; status: number; body: string }
  | { ok: false; status?: number; reason: 'status' | 'network' | 'timeout' };

export interface RaceosRequest {
  url: string;
  method?: 'GET' | 'POST';
  /** Serialised as JSON and sent with a matching content-type. */
  body?: unknown;
  /**
   * The access token, when the call needs one.
   *
   * Sent as `Game-Authorization`, and bare -- no `Bearer ` prefix. The
   * service's own client does carry that prefix as a string constant, so it
   * may well accept both; the bare form is the one observed working against
   * the live service, so it is the one sent here.
   */
  token?: string;
}

export type RaceosTransport = (
  request: RaceosRequest
) => Promise<RaceosResponse>;

export function createRaceosTransport(): RaceosTransport {
  // One keep-alive agent: the auth call and the lookup that follows it go to
  // the same host moments apart, and a second TLS handshake is pure latency.
  const agent = new https.Agent({
    keepAlive: true,
    maxSockets: 2,
    keepAliveMsecs: 10_000,
  });

  return ({ url, method = 'GET', body, token }) =>
    new Promise<RaceosResponse>((resolve) => {
      let settled = false;
      const settle = (response: RaceosResponse) => {
        if (settled) return;
        settled = true;
        resolve(response);
      };

      let target: URL;
      try {
        target = new URL(url);
      } catch {
        settle({ ok: false, reason: 'network' });
        return;
      }

      const payload = body === undefined ? undefined : JSON.stringify(body);
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (payload !== undefined) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = String(Buffer.byteLength(payload));
      }
      if (token) headers['Game-Authorization'] = token;

      const request = https.request(
        {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port || 443,
          path: `${target.pathname}${target.search}`,
          method,
          agent,
          headers,
          timeout: RACEOS_TIMEOUT_MS,
        },
        (response) => {
          const status = response.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            // Drain before giving up, or the keep-alive socket is left with an
            // unread body and the next request on it reads the wrong reply.
            response.resume();
            settle({ ok: false, status, reason: 'status' });
            return;
          }
          let text = '';
          response.setEncoding('utf8');
          response.on('data', (chunk: string) => {
            text += chunk;
          });
          response.on('end', () => settle({ ok: true, status, body: text }));
          response.on('error', () => settle({ ok: false, reason: 'network' }));
        }
      );

      request.on('timeout', () => {
        request.destroy();
        settle({ ok: false, reason: 'timeout' });
      });
      request.on('error', () => settle({ ok: false, reason: 'network' }));

      if (payload !== undefined) request.write(payload);
      request.end();
    });
}
