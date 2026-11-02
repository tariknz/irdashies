import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogValue } from '@irdashies/types';
import type { MockInstance } from 'vitest';

describe('renderer logger IPC diagnostics', () => {
  let consoleError: MockInstance;
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'logBridge');
  });

  it('retains Error and HID DOMException details through a cloneable IPC payload', async () => {
    const log = vi.fn();
    window.logBridge = { log };
    const { default: logger } = await import('./logger');
    const error = Object.assign(new SyntaxError('invalid data'), {
      code: 'EINVAL',
    });
    const hidError = new DOMException(
      'Could not open device',
      'NotAllowedError'
    );
    logger.error('[Gamepad] failed to open device', hidError, error);
    const payload: LogValue[] = JSON.parse(JSON.stringify(log.mock.calls[0]));
    expect(payload).toEqual([
      'error',
      '[Gamepad] failed to open device',
      expect.objectContaining({
        name: 'NotAllowedError',
        message: 'Could not open device',
        code: hidError.code,
      }),
      expect.objectContaining({
        name: 'SyntaxError',
        message: 'invalid data',
        code: 'EINVAL',
        stack: expect.any(String),
      }),
    ]);
    // DevTools keeps the original errors, including their native inspectors.
    expect(consoleError).toHaveBeenCalledWith(
      '[Gamepad] failed to open device',
      hidError,
      error
    );
  });

  it('logs safely without a bridge and if IPC rejects or diagnostics are circular', async () => {
    const { default: logger } = await import('./logger');
    expect(() => logger.warn('storybook')).not.toThrow();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const log = vi.fn(() => {
      throw new Error('renderer closing');
    });
    window.logBridge = { log };
    expect(() => logger.error(circular, 42n)).not.toThrow();
    expect(log).toHaveBeenCalledWith('error', { self: '[Circular]' }, '42n');
  });

  it('still forwards diagnostics when the local console fails', async () => {
    consoleError.mockImplementation(() => {
      throw new Error('console unavailable');
    });
    const log = vi.fn();
    window.logBridge = { log };
    const { default: logger } = await import('./logger');
    expect(() => logger.error('diagnostic')).not.toThrow();
    expect(log).toHaveBeenCalledWith('error', 'diagnostic');
  });
});
