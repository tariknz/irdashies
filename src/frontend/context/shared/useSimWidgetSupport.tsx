import { useEffect, useState } from 'react';
import {
  DEFAULT_SIM_WIDGET_SUPPORT,
  type SimWidgetSupportConfig,
} from '@irdashies/types';
import { useDashboardBridge } from '../DashboardContext/DashboardContext';

/**
 * The per-simulator disabled-widget list, read once from the main process.
 *
 * Starts on the bundled defaults rather than on an empty list so the first
 * paint matches what the file almost always says — an empty start would flash
 * every widget as available before hiding some of them again.
 */
export const useSimWidgetSupport = (): SimWidgetSupportConfig => {
  const bridge = useDashboardBridge();
  const [config, setConfig] = useState<SimWidgetSupportConfig>(
    DEFAULT_SIM_WIDGET_SUPPORT
  );

  useEffect(() => {
    let cancelled = false;
    void bridge?.getSimWidgetSupport?.().then((loaded) => {
      if (!cancelled && loaded) setConfig(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  return config;
};
