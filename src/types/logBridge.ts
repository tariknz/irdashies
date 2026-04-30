export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogBridge {
  log: (level: LogLevel, ...args: unknown[]) => void;
}
