import type { LogLevel } from '@irdashies/types';
import { serializeLogArgs } from '@irdashies/shared';

/**
 * Frontend logger.
 *
 * When running inside Electron, logs are forwarded to the main process
 * via IPC so they are persisted to the log file (survives terser's
 * drop_console in production builds).
 *
 * Falls back to console when the bridge is unavailable (Storybook, tests).
 */

const consoleMethods = {
  debug: console.debug.bind(console),
  info: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
} as const;

function createMethod(level: LogLevel) {
  return (...args: unknown[]) => {
    // Always log to console for DevTools visibility in dev
    try {
      consoleMethods[level](...args);
    } catch {
      // A failing console/inspector must not prevent file diagnostics.
    }

    // Forward to main process for file persistence
    try {
      window.logBridge?.log(level, ...serializeLogArgs(args));
    } catch {
      // Logging must not turn a failed/closed renderer bridge into a crash.
    }
  };
}

const logger = {
  debug: createMethod('debug'),
  info: createMethod('info'),
  warn: createMethod('warn'),
  error: createMethod('error'),
};

export type Logger = typeof logger;

export default logger;
