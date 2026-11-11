import { useDashboard } from '@irdashies/context';
import type { DeltaSpeedConfig } from '@irdashies/types';
import { DeltaSpeedDisplay } from './DeltaSpeedDisplay';
import { DeltaSpeedPreview } from './DeltaSpeedPreview';
import { useDeltaSpeed } from './hooks/useDeltaSpeed';

const LiveDeltaSpeed = (config: DeltaSpeedConfig) => {
  const deltaKph = useDeltaSpeed();
  return <DeltaSpeedDisplay {...config} deltaKph={deltaKph} />;
};

export const DeltaSpeed = (config: DeltaSpeedConfig) => {
  const { isDemoMode } = useDashboard();
  return isDemoMode ? (
    <DeltaSpeedPreview {...config} />
  ) : (
    <LiveDeltaSpeed {...config} />
  );
};
