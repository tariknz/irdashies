import http from 'node:http';
import { REST_TIMEOUT_MS } from './constants';
import type { LmuRestResponse, LmuRestTransport } from './poller';

/**
 * The only IO in the LMU REST feature.
 *
 * Built on `node:http` directly, following
 * src/app/irsdk/node/utils/sim-status.ts -- the one other place in the main
 * process that polls a sim's local endpoint -- including the convention that a
 * refused connection means "the thing is not running" rather than an error
 * worth surfacing. There is no HTTP client dependency in this app and this is
 * not a good enough reason to add one.
 *
 * Returns a result rather than throwing, so the poller never has to reason
 * about exception types. `reason` distinguishes the one case the poller treats
 * specially: `refused` on a first request means the API is absent entirely.
 *
 * One keep-alive agent with a single socket. At a 200 ms base rate a fresh TCP
 * handshake per request is pure waste, and capping at one socket means a slow
 * reply queues rather than fanning out connections at the sim.
 */
export function createLmuRestTransport(origin: string): LmuRestTransport {
  const base = new URL(origin);
  const agent = new http.Agent({
    keepAlive: true,
    maxSockets: 1,
    keepAliveMsecs: 5000,
  });

  return (path: string): Promise<LmuRestResponse> =>
    new Promise<LmuRestResponse>((resolve) => {
      // Resolved exactly once; a timeout and a socket error can both fire.
      let settled = false;
      const settle = (response: LmuRestResponse) => {
        if (settled) return;
        settled = true;
        resolve(response);
      };

      const request = http.request(
        {
          protocol: base.protocol,
          hostname: base.hostname,
          port: base.port,
          path,
          method: 'GET',
          agent,
          headers: { Accept: 'application/json' },
          timeout: REST_TIMEOUT_MS,
        },
        (response) => {
          const status = response.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            // Drain before destroying, or the keep-alive socket is left with
            // an unread body and the next request on it reads the wrong reply.
            response.resume();
            settle({ ok: false, reason: 'status' });
            return;
          }
          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk: string) => {
            body += chunk;
          });
          response.on('end', () => settle({ ok: true, body }));
          response.on('error', () => settle({ ok: false, reason: 'network' }));
        }
      );

      request.on('timeout', () => {
        request.destroy();
        settle({ ok: false, reason: 'timeout' });
      });

      request.on('error', (error: NodeJS.ErrnoException) => {
        // ECONNREFUSED is the ordinary "LMU is not serving this" answer, not a
        // fault. See the same reasoning in sim-status.ts.
        settle({
          ok: false,
          reason:
            error?.code === 'ECONNREFUSED' || error?.code === 'ECONNRESET'
              ? 'refused'
              : 'network',
        });
      });

      request.end();
    });
}
