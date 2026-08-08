import type { ChannelBridge } from '@irdashies/types';
import { useReferenceLapStoreUpdater } from './ReferenceLapStoreUpdater';

export interface ReferenceRegistryProviderProps {
  bridge?: ChannelBridge;
}

/**
 * Provider that monitors telemetry to maintain reference lap data.
 * Should be mounted once at the app level.
 */
export const ReferenceStoreProvider = ({
  bridge,
}: ReferenceRegistryProviderProps) => {
  useReferenceLapStoreUpdater(bridge);
  return null;
};
