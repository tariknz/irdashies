import { describe, expect, it, vi } from 'vitest';
import { MAX_LOG_JSON_LENGTH, serializeLogArgs } from './logSerialization';

describe('serializeLogArgs', () => {
  it.each([new Error('disk read failed'), new SyntaxError('invalid YAML')])(
    'copies non-enumerable exception fields: %s',
    (error) => {
      const result = serializeLogArgs([error]);
      expect(JSON.parse(JSON.stringify(result))).toEqual([
        { name: error.name, message: error.message, stack: error.stack },
      ]);
    }
  );

  it('preserves a real HID DOMException and DOMException-like inherited fields', () => {
    const domError = new DOMException(
      'Failed to open the device',
      'NotAllowedError'
    );
    const like = Object.create({
      name: 'NetworkError',
      message: 'Device removed',
      code: 19,
    });
    expect(serializeLogArgs([domError, like])).toEqual([
      expect.objectContaining({
        name: 'NotAllowedError',
        message: 'Failed to open the device',
        code: domError.code,
      }),
      { name: 'NetworkError', message: 'Device removed', code: 19 },
    ]);
  });

  it('keeps plain context, nested causes and non-Error thrown values cloneable', () => {
    const cause = Object.assign(new Error('missing native dependency'), {
      code: 'ERR_DLOPEN_FAILED',
    });
    const result = serializeLogArgs([
      new Error('probe failed', { cause }),
      { simulator: 'lmu', attempt: 2, available: false },
      'thrown string',
      17,
      null,
      undefined,
      42n,
      Symbol('value'),
      () => undefined,
    ]);
    expect(result).toEqual([
      expect.objectContaining({
        cause: expect.objectContaining({
          message: cause.message,
          code: 'ERR_DLOPEN_FAILED',
        }),
      }),
      { simulator: 'lmu', attempt: 2, available: false },
      'thrown string',
      17,
      null,
      '[undefined]',
      '42n',
      '[symbol]',
      '[function]',
    ]);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('handles cycles, throwing getters, toJSON and revoked proxies safely', () => {
    const getter = vi.fn(() => {
      throw new Error('unsafe getter');
    });
    const toJSON = vi.fn(() => {
      throw new Error('unsafe toJSON');
    });
    const value = {
      toJSON,
      get secret() {
        return getter();
      },
      self: null as unknown,
    };
    value.self = value;
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    const error = new Error('bad');
    Object.defineProperty(error, 'stack', { get: getter });
    const result = serializeLogArgs([value, proxy, error]);
    expect(result).toEqual([
      { toJSON: '[function]', secret: '[Getter omitted]', self: '[Circular]' },
      '[Unserializable]',
      expect.objectContaining({ message: 'bad', stack: '[Unreadable]' }),
    ]);
    expect(toJSON).not.toHaveBeenCalled();
    expect(getter).toHaveBeenCalledOnce(); // Only the known stack field.
  });

  it('bounds strings, stack, depth, width and argument count, omitting binary data', () => {
    const error = new Error('loader failed');
    error.stack = 'useful loader frame\n'.repeat(10000);
    const nested = { a: { b: { c: { d: { private: 'deep' } } } } };
    const wide = Object.fromEntries(
      Array.from({ length: 10000 }, (_, i) => [i, 'value'])
    );
    const result = serializeLogArgs([
      error,
      nested,
      wide,
      new Uint8Array(100000),
      'secret'.repeat(10000),
      ...Array(30).fill('x'),
    ]);
    const json = JSON.stringify(result);
    expect(json.length).toBeLessThanOrEqual(MAX_LOG_JSON_LENGTH);
    expect(result[0]).toMatchObject({
      stack: expect.stringContaining('useful loader frame'),
    });
    expect(json).toContain('[Max depth]');
    expect(json).toContain('[Truncated]');
    expect(json).toContain('[Binary data omitted]');
    expect(json).not.toContain('secretsecret');
    expect(json).not.toContain('private');
  });

  it('applies the scrubber before truncating long errors and to context keys', () => {
    const error = new Error('x'.repeat(2040) + '/Users/private/secret');
    const scrub = (s: string) => s.replaceAll('/Users/private', '<home>');
    const result = serializeLogArgs(
      [error, { '/Users/private/file': '/Users/private/file' }],
      scrub
    );
    const json = JSON.stringify(result);
    expect(json).not.toContain('/Users/private');
    expect(result[1]).toEqual({ '<home>/file': '<home>/file' });
  });

  it('does not invoke array element getters', () => {
    const getter = vi.fn(() => {
      throw new Error('unsafe');
    });
    const array: unknown[] = [];
    Object.defineProperty(array, 0, { get: getter });
    expect(serializeLogArgs([array])).toEqual([
      ['[Getter or empty slot omitted]'],
    ]);
    expect(getter).not.toHaveBeenCalled();
  });

  it('does not leave partial private paths when bounding errors before IPC redaction', () => {
    const home = '/Users/private-person';
    const error = new Error('x'.repeat(2040) + home + '/config.json');
    error.stack = 'Error: failed\n' + 'x'.repeat(4070) + home + '/module.js';
    const ipc = serializeLogArgs([error]);
    const analytics = serializeLogArgs(ipc, (s) =>
      s.replaceAll(home, '<home>')
    );
    expect(JSON.stringify(analytics)).not.toContain('/Users/');
    expect(analytics[0]).toMatchObject({ stack: 'Error: failed\n[Truncated]' });
  });
});
