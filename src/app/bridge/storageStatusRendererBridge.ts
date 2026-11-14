import type {
  StorageStatus,
  StorageStatusBridge,
} from '../../types/storageStatus';
import { createSharedSubscription, defineBridge } from './defineBridge';

export const exposeStorageStatusBridge = () =>
  defineBridge<StorageStatusBridge>('storageStatusBridge', {
    onStatus: createSharedSubscription({
      name: 'storageStatus',
      key: 'status',
      channel: 'storageStatus:changed',
      parse: (value) =>
        value &&
        typeof value === 'object' &&
        'diskFull' in value &&
        typeof value.diskFull === 'boolean'
          ? (value as StorageStatus)
          : undefined,
      label: '[Storage] Status',
    }),
  });
