import logger from '../logger';
import { readData, writeData } from './storage';

const ANALYTICS_OPT_OUT_KEY = 'analyticsOptOut';
let analyticsOptOut: boolean | undefined;
const optOutListeners = new Set<(optOut: boolean) => void>();

export const getAnalyticsOptOut = (): boolean => {
  // Loaded during analytics startup. Log transports must not read config.json
  // synchronously on every warning/error; settings changes update this below.
  analyticsOptOut ??= readData<boolean>(ANALYTICS_OPT_OUT_KEY) ?? false;
  return analyticsOptOut;
};

/** Called with the new value each time the player changes the opt-out. */
export const onAnalyticsOptOutChanged = (
  listener: (optOut: boolean) => void
): (() => void) => {
  optOutListeners.add(listener);
  return () => optOutListeners.delete(listener);
};

export const setAnalyticsOptOut = (optOut: boolean): void => {
  // Unknown until read counts as a change: listeners must not miss one.
  const changed = optOut !== analyticsOptOut;
  // Apply consent immediately, even if persisting it fails.
  analyticsOptOut = optOut;
  try {
    writeData(ANALYTICS_OPT_OUT_KEY, optOut);
  } finally {
    if (changed) {
      optOutListeners.forEach((listener) => {
        try {
          listener(optOut);
        } catch (err) {
          logger.error('Error in analytics opt-out listener:', err);
        }
      });
    }
  }
};
