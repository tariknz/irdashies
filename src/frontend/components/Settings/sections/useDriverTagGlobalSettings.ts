import { useState, useEffect, useCallback } from 'react';
import type { DriverTagSettings } from '@irdashies/types';
import { useDashboard } from '@irdashies/context';

const DEFAULT_SETTINGS: DriverTagSettings = {
  groups: [],
  mapping: {},
  display: { enabled: false, widthPx: 6, displayStyle: 'badge' },
};

export const useDriverTagGlobalSettings = () => {
  const { bridge } = useDashboard();
  const [tagSettings, setTagSettings] =
    useState<DriverTagSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bridge.getDriverTagSettings?.().then((settings) => {
      setTagSettings(settings ?? DEFAULT_SETTINGS);
      setLoading(false);
    });
  }, [bridge]);

  const saveTagSettings = useCallback(
    (settings: DriverTagSettings) => {
      setTagSettings(settings);
      bridge.saveDriverTagSettings?.(settings);
    },
    [bridge]
  );

  return { tagSettings, loading, saveTagSettings };
};
