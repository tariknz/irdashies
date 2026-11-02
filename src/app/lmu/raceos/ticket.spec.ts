import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_TICKET_PATH, createTicketFetcher } from './ticket';
import type { LmuRestResponse } from '../rest/poller';

/**
 * The first link in the rating chain, and the one most likely to be the reason
 * there are no badges.
 *
 * The endpoint was recovered from another application rather than documented,
 * so every outcome here is a real possibility on some build of the sim: a
 * refused connection, a 404, an empty body, a shape nobody expected. Each used
 * to be logged distinctly; the logs are gone, so what is asserted now is that
 * every one of them comes back as undefined rather than throwing or returning
 * a body that is not a ticket.
 */
describe('createTicketFetcher', () => {
  const ok = (body: string): LmuRestResponse => ({ ok: true, body });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks the sim for the ticket path', async () => {
    const transport = vi.fn(async () => ok('"abc"'));

    await createTicketFetcher(transport)();

    expect(transport).toHaveBeenCalledWith(AUTH_TICKET_PATH);
  });

  it('accepts a bare quoted string', async () => {
    const fetch = createTicketFetcher(vi.fn(async () => ok('"ticket-abc"')));

    await expect(fetch()).resolves.toBe('ticket-abc');
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
  });

  it('comes back with nothing for every unusable answer', async () => {
    // A refused connection, a 404, an empty body, a shape nobody expected,
    // and JSON whose values are not tickets. Each called for a different fix
    // and each used to say so in the log; what matters to the caller is that
    // none of them yields a ticket and none of them throws.
    const answers: LmuRestResponse[] = [
      { ok: false, reason: 'refused' },
      { ok: false, reason: 'status' },
      ok(''),
      ok('   '),
      ok('{}'),
      ok('{"ticket":123}'),
      ok('{"unexpected":"abc"}'),
      ok('[]'),
      ok('null'),
    ];

    for (const answer of answers) {
      const fetch = createTicketFetcher(vi.fn(async () => answer));
      await expect(fetch()).resolves.toBeUndefined();
    }
  });

  it('asks again on every call, holding nothing from a failure', async () => {
    // The fetcher is stateless now that the deduped log is gone, so a
    // transient failure cannot latch it off.
    const transport = vi
      .fn<(path: string) => Promise<LmuRestResponse>>()
      .mockResolvedValueOnce({ ok: false, reason: 'refused' })
      .mockResolvedValue(ok('"ticket-abc"'));
    const fetch = createTicketFetcher(transport);

    await expect(fetch()).resolves.toBeUndefined();
    await expect(fetch()).resolves.toBe('ticket-abc');
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
