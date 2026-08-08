import { useEffect } from 'react';
import {
  useSectorTimingSnapshot,
  useSectorTimingStore,
} from '@irdashies/context';

export const SectorTimingUpdater = ({
  enabled = true,
}: {
  enabled?: boolean;
}) => {
  const snapshot = useSectorTimingSnapshot(enabled);
  const applySnapshot = useSectorTimingStore((state) => state.applySnapshot);
  useEffect(() => {
    if (snapshot) applySnapshot(snapshot);
  }, [applySnapshot, snapshot]);
  return null;
};
