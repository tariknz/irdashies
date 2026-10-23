import { describe, expect, it, vi } from 'vitest';
import { createIracePlanClient, IRACEPLAN_BASE_URL } from './iracePlanClient';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('iracePlanClient', () => {
  it('sends the key only as a bearer token to the fixed host', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ planning: { id: 1 } }));
    const client = createIracePlanClient(fetcher as typeof fetch);
    const result = await client.getPlanning('key-123', 1);
    expect(result).toEqual({ ok: true, body: { planning: { id: 1 } } });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`${IRACEPLAN_BASE_URL}/api/v1/plannings/1`);
    expect(new URL(url).host).toBe('iraceplan.com');
    expect(init.headers).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer key-123',
    });
    expect(init.redirect).toBe('error');
    expect(url).not.toContain('key-123');
  });

  it('lists plannings', async () => {
    const body = { plannings: [], meta: { count: 0, total: 0 } };
    const fetcher = vi.fn(async () => jsonResponse(body));
    const client = createIracePlanClient(fetcher as typeof fetch);
    expect(await client.listPlannings('k')).toEqual({ ok: true, body });
    expect(fetcher.mock.calls[0]).toContain(
      `${IRACEPLAN_BASE_URL}/api/v1/plannings`
    );
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [404, 'not-found'],
    [500, 'network'],
    [429, 'network'],
  ])('maps HTTP %i to %s', async (status, error) => {
    const client = createIracePlanClient((async () =>
      jsonResponse({}, status)) as typeof fetch);
    expect(await client.getPlanning('k', 1)).toEqual({ ok: false, error });
  });

  it('maps an unknown planning id (200, empty body) to not-found', async () => {
    const client = createIracePlanClient(
      (async () => new Response('', { status: 200 })) as typeof fetch
    );
    expect(await client.getPlanning('k', 999_999_999)).toEqual({
      ok: false,
      error: 'not-found',
    });
  });

  it.each([200, 400, 422])(
    'maps an "Invalid API key" error body with HTTP %i to unauthorized',
    async (status) => {
      const client = createIracePlanClient((async () =>
        jsonResponse({ error: 'Invalid API key' }, status)) as typeof fetch);
      expect(await client.listPlannings('bad')).toEqual({
        ok: false,
        error: 'unauthorized',
      });
    }
  );

  it('maps any other error body on 200 to invalid-response', async () => {
    const client = createIracePlanClient((async () =>
      jsonResponse({ error: 'Something broke' })) as typeof fetch);
    expect(await client.getPlanning('k', 1)).toEqual({
      ok: false,
      error: 'invalid-response',
    });
  });

  it('maps a timeout or dropped connection to network', async () => {
    const client = createIracePlanClient((async () => {
      throw new DOMException('timed out', 'TimeoutError');
    }) as typeof fetch);
    expect(await client.getPlanning('k', 1)).toEqual({
      ok: false,
      error: 'network',
    });
  });

  it('maps bad JSON to invalid-response', async () => {
    const client = createIracePlanClient(
      (async () => new Response('{not json', { status: 200 })) as typeof fetch
    );
    expect(await client.getPlanning('k', 1)).toEqual({
      ok: false,
      error: 'invalid-response',
    });
  });

  it('refuses a response that is too large', async () => {
    const client = createIracePlanClient(
      (async () =>
        new Response(`"${'x'.repeat(2_100_000)}"`, {
          status: 200,
        })) as typeof fetch
    );
    expect(await client.getPlanning('k', 1)).toEqual({
      ok: false,
      error: 'invalid-response',
    });
  });
});
