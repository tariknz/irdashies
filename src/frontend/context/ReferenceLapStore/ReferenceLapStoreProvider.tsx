import { ReferenceLapBridge } from '../../../types/referenceLaps';
import { useReferenceRegistryUpdater } from './ReferenceLapStoreUpdater';

export interface ReferenceRegistryProviderProps {
  bridge: ReferenceLapBridge;
}

/**
 * Provider that monitors telemetry to maintain reference lap data.
 * Should be mounted once at the app level.
 */
export const ReferenceStoreProvider = ({
  bridge,
}: ReferenceRegistryProviderProps) => {
  useReferenceRegistryUpdater(bridge);
  return null;
};
