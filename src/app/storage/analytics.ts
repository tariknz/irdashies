import { readData, writeData } from './storage';

const ANALYTICS_OPT_OUT_KEY = 'analyticsOptOut';

export const getAnalyticsOptOut = (): boolean => {
  const optOut = readData<boolean>(ANALYTICS_OPT_OUT_KEY);
  return optOut ?? false;
};

export const setAnalyticsOptOut = (optOut: boolean): void => {
  writeData(ANALYTICS_OPT_OUT_KEY, optOut);
};

