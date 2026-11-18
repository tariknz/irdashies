import { useEffect, useState } from 'react';
import {
  DEFAULT_SIM_WIDGET_SUPPORT,
  type SimWidgetSupportConfig,
} from '@irdashies/types';
import { useDashboardBridge } from '../DashboardContext/DashboardContext';

export interface SimWidgetSupportStatus {
  config: SimWidgetSupportConfig;
  /**
   * True once the main process has answered, or when there is nothing to
   * wait for. Until then `config` is the bundled defaults, which the user's
   * file can contradict.
   */
  loaded: boolean;
}

/**
 * The per-simulator disabled-widget list, read once from the main process,
 * and whether it has arrived.
 *
 * Starts on the bundled defaults rather than on an empty list so the first
 * paint matches what the file almost always says — an empty start would flash
 * every widget as available before hiding some of them again.
 */
export const useSimWidgetSupportStatus = (): SimWidgetSupportStatus => {
  const bridge = useDashboardBridge();
  const [status, setStatus] = useState<SimWidgetSupportStatus>(() => ({
    config: DEFAULT_SIM_WIDGET_SUPPORT,
    loaded: !bridge?.getSimWidgetSupport,
  }));

  useEffect(() => {
    const request = bridge?.getSimWidgetSupport?.();
    if (!request) return;
    let cancelled = false;
    request.then(
      (loaded) => {
        if (!cancelled)
          setStatus((current) => ({
            config: loaded ?? current.config,
            loaded: true,
          }));
      },
      // No answer: the defaults are all there is.
      () => {
        if (!cancelled) setStatus((current) => ({ ...current, loaded: true }));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  return status;
};

/** The per-simulator disabled-widget list: the bundled defaults until the file arrives. */
export const useSimWidgetSupport = (): SimWidgetSupportConfig =>
  useSimWidgetSupportStatus().config;
