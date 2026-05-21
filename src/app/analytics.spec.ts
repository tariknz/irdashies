import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { LogMessage } from 'electron-log';
import type { EventMessage, IdentifyMessage } from 'posthog-node';

vi.mock('electron', () => ({
  screen: {
    getAllDisplays: vi.fn().mockReturnValue([]),
    getPrimaryDisplay: vi
      .fn()
      .mockReturnValue({ size: { width: 0, height: 0 } }),
  },
}));

const { loggerStub } = vi.hoisted(() => ({
  loggerStub: {
    transports: {
      file: { level: 'info', maxSize: 0 },
      console: { level: 'debug' },
    } as Record<string, unknown>,
    initialize: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('electron-log/main', () => ({
  default: loggerStub,
}));

vi.mock('./storage/storage', () => ({
  readData: vi.fn(),
  writeData: vi.fn(),
}));

vi.mock('./storage/analytics', () => ({
  getAnalyticsOptOut: vi.fn().mockReturnValue(true),
}));

import { Analytics, type AnalyticsProvider } from './analytics';
import logger from './logger';

const makeProvider = () => ({
  capture: vi.fn<(event: EventMessage) => void>(),
  identify: vi.fn<(message: IdentifyMessage) => void>(),
  shutdown: vi.fn<(shutdownTimeoutMs?: number) => void>(),
});

const emit = (level: LogMessage['level'], ...data: unknown[]): void => {
  const transport = logger.transports.posthog as unknown as (
    msg: LogMessage
  ) => void;
  transport({ level, data, date: new Date() } as LogMessage);
};

describe('Analytics.setupLogTransport', () => {
  let provider: ReturnType<typeof makeProvider>;
  let analytics: Analytics;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    provider = makeProvider();
    analytics = new Analytics(provider);
    analytics.setupLogTransport();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete logger.transports.posthog;
  });

  it('forwards a log message to the provider', () => {
    emit('warn', 'something went wrong');
    expect(provider.capture).toHaveBeenCalledWith({
      event: 'log_message',
      properties: { level: 'warn', message: 'something went wrong' },
    });
  });

  it('suppresses identical messages within the dedup window', () => {
    emit('warn', 'flooded message');
    vi.advanceTimersByTime(30 * 60 * 1000);
    emit('warn', 'flooded message');
    expect(provider.capture).toHaveBeenCalledTimes(1);
  });

  it('re-emits an identical message after the dedup window elapses', () => {
    emit('warn', 'flooded message');
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    emit('warn', 'flooded message');
    expect(provider.capture).toHaveBeenCalledTimes(2);
  });

  it('treats the same text at different levels as distinct', () => {
    emit('warn', 'same text');
    emit('error', 'same text');
    expect(provider.capture).toHaveBeenCalledTimes(2);
  });

  it('keys on the first 30 characters — messages sharing that prefix collide', () => {
    const prefix = 'a'.repeat(30);
    emit('warn', `${prefix}-foo`);
    emit('warn', `${prefix}-bar`);
    expect(provider.capture).toHaveBeenCalledTimes(1);
  });

  it('stringifies non-string log data', () => {
    emit('warn', 'context:', { code: 42 });
    expect(provider.capture).toHaveBeenCalledWith({
      event: 'log_message',
      properties: { level: 'warn', message: 'context: {"code":42}' },
    });
  });

  it('does nothing when the provider is absent', () => {
    const noopAnalytics = new Analytics(provider);
    // Force provider to null by going through the public surface
    (
      noopAnalytics as unknown as { provider: AnalyticsProvider | null }
    ).provider = null;
    delete logger.transports.posthog;
    noopAnalytics.setupLogTransport();
    expect(logger.transports.posthog).toBeUndefined();
  });
});
