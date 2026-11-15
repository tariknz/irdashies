import { ipcRenderer } from 'electron';
import type { WindowVisibilityBridge } from '../../types/windowVisibility';
import { createSubscriptionBridgeClient, defineBridge } from './defineBridge';

export const exposeWindowVisibilityBridge = () => {
  const subscription =
    createSubscriptionBridgeClient<'visible'>('windowVisibility');
  let consumers = 0;
  return defineBridge<WindowVisibilityBridge>('windowVisibilityBridge', {
    onVisibilityChanged(callback) {
      const listener = (_event: Electron.IpcRendererEvent, value: unknown) => {
        if (typeof value === 'boolean') callback(value);
      };
      ipcRenderer.on('windowVisibility:changed', listener);
      consumers++;
      void subscription
        .subscribe('visible')
        .catch(() =>
          ipcRenderer.send(
            'log',
            'warn',
            '[WindowVisibility] Subscription failed'
          )
        );
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        ipcRenderer.removeListener('windowVisibility:changed', listener);
        if (--consumers === 0)
          void subscription
            .unsubscribe('visible')
            .catch(() =>
              ipcRenderer.send(
                'log',
                'warn',
                '[WindowVisibility] Unsubscribe failed'
              )
            );
      };
    },
  });
};
