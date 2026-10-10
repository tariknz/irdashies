import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createLmuRestTransport } from './httpJson';
import { lmuRestOrigin, LMU_REST_ORIGIN } from './constants';

/**
 * These bind an ephemeral loopback port rather than mocking node:http.
 *
 * The whole value of this module is its behaviour against a real socket --
 * status codes, a refused connect, a hung reply -- and a mock of `http.request`
 * would only assert that the mock was called.
 */
let server: http.Server | undefined;

const listen = async (
  handler: http.RequestListener
): Promise<{ origin: string }> => {
  server = http.createServer(handler);
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { origin: `http://127.0.0.1:${port}` };
};

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  }
  delete process.env.IRDASHIES_LMU_REST_URL;
});

describe('createLmuRestTransport', () => {
  it('returns the body of a 200', async () => {
    const { origin } = await listen((_, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"total":30}');
    });

    const result = await createLmuRestTransport(origin)('/rest/x');

    expect(result).toEqual({ ok: true, body: '{"total":30}' });
  });

  it('requests the path it was given, asking for JSON', async () => {
    let seenUrl = '';
    let seenAccept: string | undefined;
    const { origin } = await listen((req, res) => {
      seenUrl = req.url ?? '';
      seenAccept = req.headers.accept;
      res.writeHead(200);
      res.end('{}');
    });

    await createLmuRestTransport(origin)('/rest/strategy/pitstop-estimate');

    expect(seenUrl).toBe('/rest/strategy/pitstop-estimate');
    expect(seenAccept).toBe('application/json');
  });

  it('reports a non-2xx as a status failure, not as a body', async () => {
    const { origin } = await listen((_, res) => {
      res.writeHead(404);
      res.end('not here');
    });

    const result = await createLmuRestTransport(origin)('/rest/x');

    expect(result).toEqual({ ok: false, reason: 'status' });
  });

  it('reports a closed port as refused, which is how absence looks', async () => {
    // Bind, read the port, then close it, so nothing is listening there.
    const { origin } = await listen((_, res) => res.end());
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;

    const result = await createLmuRestTransport(origin)('/rest/x');

    expect(result).toEqual({ ok: false, reason: 'refused' });
  });

  it('times out rather than hanging on a reply that never comes', async () => {
    const { origin } = await listen(() => {
      // Deliberately never respond.
    });

    const result = await createLmuRestTransport(origin)('/rest/x');

    expect(result).toEqual({ ok: false, reason: 'timeout' });
  }, 10_000);

  it('reuses its socket across requests', async () => {
    // A fresh handshake per request at a 200 ms base rate is pure waste.
    const sockets = new Set<unknown>();
    const { origin } = await listen((req, res) => {
      sockets.add(req.socket);
      res.writeHead(200);
      res.end('{}');
    });

    const transport = createLmuRestTransport(origin);
    await transport('/rest/a');
    await transport('/rest/b');
    await transport('/rest/c');

    expect(sockets.size).toBe(1);
  });

  it('assembles a body that arrives in several chunks', async () => {
    const { origin } = await listen((_, res) => {
      res.writeHead(200);
      res.write('{"to');
      res.write('tal":');
      res.end('30}');
    });

    const result = await createLmuRestTransport(origin)('/rest/x');

    expect(result).toEqual({ ok: true, body: '{"total":30}' });
  });
});

describe('lmuRestOrigin', () => {
  it('defaults to the fixed loopback port LMU serves on', () => {
    expect(lmuRestOrigin()).toBe(LMU_REST_ORIGIN);
    // 127.0.0.1, not localhost: localhost can resolve IPv6-first on Windows.
    expect(LMU_REST_ORIGIN).toBe('http://127.0.0.1:6397');
  });

  it('honours the debugging override', () => {
    process.env.IRDASHIES_LMU_REST_URL = 'http://192.168.1.5:7000';
    expect(lmuRestOrigin()).toBe('http://192.168.1.5:7000');
  });

  it('ignores a blank override', () => {
    process.env.IRDASHIES_LMU_REST_URL = '   ';
    expect(lmuRestOrigin()).toBe(LMU_REST_ORIGIN);
  });
});
