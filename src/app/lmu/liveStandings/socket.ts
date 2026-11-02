import WebSocket from 'ws';
import type { LmuSocketFactory } from './client';

/**
 * The real socket, behind the factory the client takes.
 *
 * `ws` rather than Node's global WebSocket: it is already a dependency of this
 * app (src/app/webserver/bridgeProxy.ts serves over it), it is typed, and it
 * sends no `Origin` header -- which matters here, because this is a server
 * inside the sim and an origin check is the one thing that would turn a
 * working handshake from a browser into a refused one from us.
 *
 * Everything above this file is pure and injected, so this is the only part of
 * the feed a spec cannot drive. It is kept to the adapter for that reason:
 * three event bindings and no logic.
 */

/** A loopback handshake either answers at once or is not there. */
const HANDSHAKE_TIMEOUT_MS = 2000;

export const createLmuWebSocket: LmuSocketFactory = (url, handlers) => {
  const ws = new WebSocket(url, { handshakeTimeout: HANDSHAKE_TIMEOUT_MS });

  /**
   * The error's message, kept for the close that follows it.
   *
   * `ws` emits 'error' and then 'close' for a failed connection, and the close
   * carries a bare 1006 with no reason. The error is the half that says what
   * went wrong, so it is held here and handed to the one onClose the client
   * expects rather than reported separately.
   */
  let failure: string | undefined;

  ws.on('open', () => handlers.onOpen());
  ws.on('message', (data, isBinary) => {
    if (isBinary) return;
    handlers.onText(data.toString());
  });
  ws.on('error', (error: Error) => {
    failure = error.message;
  });
  ws.on('close', (code, reason) => {
    const described = reason.length > 0 ? reason.toString() : '';
    handlers.onClose(failure || described || `code ${code}`);
  });

  return {
    send: (text) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(text);
    },
    close: () => {
      // terminate() rather than close() when it never opened: a close
      // handshake on a socket that is still connecting waits for a peer that
      // may not be there.
      if (ws.readyState === WebSocket.OPEN) ws.close();
      else ws.terminate();
    },
  };
};
