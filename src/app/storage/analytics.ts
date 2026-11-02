import { readData, writeData } from './storage';

const ANALYTICS_OPT_OUT_KEY = 'analyticsOptOut';
let analyticsOptOut: boolean | undefined;

export const getAnalyticsOptOut = (): boolean => {
  // Loaded during analytics startup. Log transports must not read config.json
  // synchronously on every warning/error; settings changes update this below.
  analyticsOptOut ??= readData<boolean>(ANALYTICS_OPT_OUT_KEY) ?? false;
  return analyticsOptOut;
};

export const setAnalyticsOptOut = (optOut: boolean): void => {
  // Apply consent immediately, even if persisting it fails.
  analyticsOptOut = optOut;
  writeData(ANALYTICS_OPT_OUT_KEY, optOut);
};
