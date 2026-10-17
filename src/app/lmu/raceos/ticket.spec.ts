import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_TICKET_PATH, createTicketFetcher } from './ticket';
import logger from '../../logger';
import type { LmuRestResponse } from '../rest/poller';

vi.mock('../../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/**
 * The first link in the rating chain, and the one most likely to be the reason
 * there are no badges.
 *
 * The endpoint was recovered from another application rather than documented,
 * so every outcome here is a real possibility on some build of the sim: a
 * refused connection, a 404, an empty body, a shape nobody expected. They call
 * for different fixes, which is why each is reported distinctly rather than
 * all collapsing into "no ticket".
 */
describe('createTicketFetcher', () => {
  const ok = (body: string): LmuRestResponse => ({ ok: true, body });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const noted = () =>
    vi.mocked(logger.info).mock.calls.map(([message]) => String(message));

  it('asks the sim for the ticket path', async () => {
    const transport = vi.fn(async () => ok('"abc"'));

    await createTicketFetcher(transport)();

    expect(transport).toHaveBeenCalledWith(AUTH_TICKET_PATH);
  });

  it('accepts a bare quoted string', async () => {
    const fetch = createTicketFetcher(vi.fn(async () => ok('"ticket-abc"')));

    await expect(fetch()).resolves.toBe('ticket-abc');
    expect(noted().join(' ')).toContain('bare string');
  });

  it('accepts a wrapped ticket under any of the known keys', async () => {
    for (const key of ['ticket', 'authSessionTicket', 'token']) {
      const fetch = createTicketFetcher(
        vi.fn(async () => ok(JSON.stringify({ [key]: 'ticket-abc' })))
      );

      await expect(fetch()).resolves.toBe('ticket-abc');
    }
  });

  it('accepts a bare unquoted body', async () => {
    // Not JSON at all, which is how at least one build answers.
    const fetch = createTicketFetcher(vi.fn(async () => ok('ticket-abc')));

    await expect(fetch()).resolves.toBe('ticket-abc');
    expect(noted().join(' ')).toContain('unquoted body');
  });

  it('reports the transport failure rather than staying silent', async () => {
    // This is the case that used to log nothing, and it is the difference
    // between "the sim is not running" and "this build has no such endpoint".
    const fetch = createTicketFetcher(
      vi.fn(async () => ({ ok: false, reason: 'status' }) as LmuRestResponse)
    );

    await expect(fetch()).resolves.toBeUndefined();
    expect(noted().join(' ')).toContain('did not answer (status)');
  });

  it('reports an empty body', async () => {
    const fetch = createTicketFetcher(vi.fn(async () => ok('   ')));

    await expect(fetch()).resolves.toBeUndefined();
    expect(noted().join(' ')).toContain('empty body');
  });

  it('names the keys when the shape is unrecognised', async () => {
    // Without the keys this is a dead end. With them it is one line of code.
    const fetch = createTicketFetcher(
      vi.fn(async () => ok(JSON.stringify({ sessionTicket: 'abc', ttl: 60 })))
    );

    await expect(fetch()).resolves.toBeUndefined();
    const message = noted().join(' ');
    expect(message).toContain('no recognisable ticket');
    expect(message).toContain('sessionTicket, ttl');
  });

  it('says the same thing once while the state persists', async () => {
    // Driven off the session poll, so an unguarded log would repeat twice a
    // second for as long as the sim was shut.
    const fetch = createTicketFetcher(
      vi.fn(async () => ({ ok: false, reason: 'network' }) as LmuRestResponse)
    );

    await fetch();
    await fetch();
    await fetch();

    expect(noted()).toHaveLength(1);
  });

  it('speaks again when the outcome changes', async () => {
    let answer: LmuRestResponse = { ok: false, reason: 'network' };
    const fetch = createTicketFetcher(vi.fn(async () => answer));

    await fetch();
    answer = ok('"ticket-abc"');
    await fetch();

    expect(noted()).toHaveLength(2);
  });
});
