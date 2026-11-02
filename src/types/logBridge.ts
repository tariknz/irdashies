export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Bounded, cloneable diagnostics; Error/DOMException fields need explicit copying. */
export type LogValue =
  string | number | boolean | null | LogValue[] | { [key: string]: LogValue };

export interface LogBridge {
  log: (level: LogLevel, ...args: LogValue[]) => void;
}
