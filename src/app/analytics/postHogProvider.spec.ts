import { afterEach, describe, expect, it, vi } from 'vitest';
import { PostHog } from 'posthog-node';
import type { EventMessage, PostHogOptions } from 'posthog-node';

vi.mock('electron', () => ({ screen: {} }));
vi.mock('../storage/storage', () => ({
  readData: vi.fn(),
  writeData: vi.fn(),
}));
vi.mock('../storage/analytics', () => ({ getAnalyticsOptOut: () => false }));
vi.mock('../logger', () => ({ default: { warn: vi.fn() } }));

import { PostHogProvider } from '../analytics';

const event: EventMessage = {
  distinctId: 'test-installation',
  event: 'pit_lane_calibration',
  uuid: 'a1111111-1111-4111-8111-111111111111',
  timestamp: new Date('2026-01-01T00:00:00.000Z'),
  properties: { data_hash: 'a'.repeat(64), track_count: 0, tracks: {} },
};
const clients: PostHog[] = [];
const makeClient = (options: Partial<PostHogOptions> = {}) => {
  const fetch = vi
    .fn<NonNullable<PostHogOptions['fetch']>>()
    .mockResolvedValue(new Response('{"status":"Ok"}', { status: 200 }));
  const client = new PostHog('test-key', {
    host: 'https://posthog.invalid',
    fetch,
    fetchRetryCount: 0,
    flushInterval: 0,
    disableCompression: true,
    enableExceptionAutocapture: false,
    ...options,
  });
  clients.push(client);
  return { client, fetch, provider: new PostHogProvider(client) };
};

afterEach(async () => {
  // Any failed SDK queue is discarded for teardown; every request is mocked.
  await Promise.all(
    clients.splice(0).map(async (client) => {
      await client.optOut();
      await client.shutdown();
    })
  );
});

describe('PostHogProvider acknowledged delivery (real SDK, mocked HTTP)', () => {
  it('confirms only after the exact UUID was flushed through HTTP 200', async () => {
    const { provider, fetch } = makeClient();
    await expect(provider.captureConfirmed(event)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledOnce();
    const options = fetch.mock.calls[0][1];
    expect(JSON.parse(String(options.body)).batch[0]).toMatchObject({
      uuid: event.uuid,
      timestamp: '2026-01-01T00:00:00.000Z',
      event: event.event,
      properties: event.properties,
    });
  });

  it('handles the automatic-flush race with its listener registered before capture', async () => {
    const { provider, fetch } = makeClient({ flushAt: 1 });
    await expect(provider.captureConfirmed(event)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('rejects actual SDK HTTP 500 failures instead of treating a queued event as acknowledged', async () => {
    const { provider, fetch } = makeClient();
    fetch.mockResolvedValue(
      new Response('{"error":"failed"}', { status: 500 })
    );
    await expect(provider.captureConfirmed(event)).rejects.toBeDefined();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('rejects actual SDK network failures', async () => {
    const { provider, fetch } = makeClient();
    fetch.mockRejectedValue(new Error('Network unavailable'));
    await expect(provider.captureConfirmed(event)).rejects.toBeDefined();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('rejects when the SDK is disabled', async () => {
    const { provider, fetch } = makeClient({ disabled: true });
    await expect(provider.captureConfirmed(event)).rejects.toThrow(
      'cannot be delivered'
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects when the SDK is opted out', async () => {
    const { provider, client, fetch } = makeClient();
    await client.optOut();
    await expect(provider.captureConfirmed(event)).rejects.toThrow(
      'cannot be delivered'
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a dropped event rather than acknowledging an empty successful flush', async () => {
    const { provider, fetch } = makeClient({ before_send: () => null });
    await expect(provider.captureConfirmed(event)).rejects.toThrow(
      'not acknowledged'
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
