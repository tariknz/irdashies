import { useEffect } from 'react';
import {
  useDashboard,
  useSectorTimingSnapshot,
  useSectorTimingStore,
} from '@irdashies/context';
import type { SectorDeltaConfig } from '@irdashies/types';

export const SectorTimingUpdater = ({
  enabled = true,
}: {
  enabled?: boolean;
}) => {
  const snapshot = useSectorTimingSnapshot(enabled);
  const applySnapshot = useSectorTimingStore((state) => state.applySnapshot);
  const setThresholds = useSectorTimingStore((state) => state.setThresholds);
  const { currentDashboard } = useDashboard();
  const thresholds = (
    currentDashboard?.widgets.find(
      (widget) => (widget.type || widget.id) === 'sectordelta'
    )?.config as SectorDeltaConfig | undefined
  )?.thresholds;

  useEffect(() => {
    setThresholds(
      (thresholds?.green ?? 0.5) / 100,
      (thresholds?.yellow ?? 1) / 100
    );
  }, [setThresholds, thresholds?.green, thresholds?.yellow]);

  useEffect(() => {
    if (snapshot) applySnapshot(snapshot);
  }, [applySnapshot, snapshot]);
  return null;
};
