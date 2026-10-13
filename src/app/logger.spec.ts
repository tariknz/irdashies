import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { writeFn, logger } = vi.hoisted(() => {
  const writeFn = vi.fn();
  return {
    writeFn,
    logger: {
      initialize: vi.fn(),
      transports: {
        console: { level: 'debug' as string | false, writeFn },
        file: { level: 'info', maxSize: 0 },
      },
    },
  };
});

vi.mock('electron-log/main', () => ({ default: logger }));

describe('console logging', () => {
  let outputErrorHandlers: ((error: Error) => void)[];

  beforeEach(async () => {
    vi.resetModules();
    writeFn.mockReset();
    logger.transports.console.writeFn = writeFn;
    outputErrorHandlers = [];
    const outputs: NodeJS.WriteStream[] = [process.stdout, process.stderr];
    for (const stream of outputs) {
      vi.spyOn(stream, 'on').mockImplementation((event, listener) => {
        if (event === 'error') outputErrorHandlers.push(listener);
        return stream;
      });
    }
    await import('./logger');
  });

  afterEach(() => vi.restoreAllMocks());

  it('handles asynchronous broken pipes on stdout and stderr', () => {
    expect(outputErrorHandlers).toHaveLength(2);
    for (const handler of outputErrorHandlers) {
      logger.transports.console.level = 'debug';
      const error = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });
      expect(() => handler(error)).not.toThrow();
      expect(logger.transports.console.level).toBe(false);
      expect(logger.transports.file.level).toBe('info');
    }
  });

  it('does not swallow unrelated output stream errors', () => {
    const error = new Error('unexpected stream failure');
    expect(() => outputErrorHandlers[0](error)).toThrow(error);
  });

  it('forwards console writes normally', () => {
    const options = { message: { level: 'info', data: ['hello'] } };
    logger.transports.console.writeFn(options);
    expect(writeFn).toHaveBeenCalledWith(options);
    expect(logger.transports.console.level).toBe('debug');
  });

  it('disables console logging on EPIPE while keeping file logging', () => {
    writeFn.mockImplementation(() => {
      throw Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });
    });
    expect(() => logger.transports.console.writeFn({})).not.toThrow();
    expect(logger.transports.console.level).toBe(false);
    expect(logger.transports.file.level).toBe('info');
  });

  it('does not swallow unrelated failures', () => {
    const error = new Error('unexpected failure');
    writeFn.mockImplementation(() => {
      throw error;
    });
    expect(() => logger.transports.console.writeFn({})).toThrow(error);
  });
});
