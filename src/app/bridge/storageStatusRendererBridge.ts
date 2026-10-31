import { ipcRenderer } from 'electron';
import type {
  StorageStatus,
  StorageStatusBridge,
} from '../../types/storageStatus';
import { defineBridge, createSubscriptionBridgeClient } from './defineBridge';

export const exposeStorageStatusBridge = () => {
  const subscription =
    createSubscriptionBridgeClient<'status'>('storageStatus');
  // Consumers share one per-window subscription; callbacks never live in main.
  let consumers = 0;
  return defineBridge<StorageStatusBridge>('storageStatusBridge', {
    onStatus(callback) {
      const listener = (_event: Electron.IpcRendererEvent, value: unknown) => {
        if (
          value &&
          typeof value === 'object' &&
          'diskFull' in value &&
          typeof value.diskFull === 'boolean'
        ) {
          callback(value as StorageStatus);
        }
      };
      ipcRenderer.on('storageStatus:changed', listener);
      consumers++;
      void subscription
        .subscribe('status')
        .catch(() =>
          ipcRenderer.send(
            'log',
            'warn',
            '[Storage] Status subscription failed'
          )
        );
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        ipcRenderer.removeListener('storageStatus:changed', listener);
        if (--consumers === 0) {
          void subscription
            .unsubscribe('status')
            .catch(() =>
              ipcRenderer.send(
                'log',
                'warn',
                '[Storage] Status unsubscribe failed'
              )
            );
        }
      };
    },
  });
};
