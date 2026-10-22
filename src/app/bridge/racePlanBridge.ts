import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import path from 'node:path';
import type { RacePlanState } from '@irdashies/types';
import { defineRendererSubscriptionBridge } from './defineBridge';
import { createRacePlanStore } from '../storage/racePlanStore';
import { createIracePlanClient } from '../services/iracePlanClient';
import {
  createRacePlanService,
  type ApiKeyCrypto,
  type RacePlanService,
} from '../services/racePlanService';
import { setRacePlanSource } from '../services/racePlanSource';

export const RACE_PLAN_STATE_EVENT = 'racePlan:state';

const safeStorageCrypto: ApiKeyCrypto = {
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
  decrypt: (base64) => safeStorage.decryptString(Buffer.from(base64, 'base64')),
};

/** Registers the race plan handlers. Every input is validated by the service. */
export function registerRacePlanHandlers(
  service: RacePlanService,
  broadcast: (state: RacePlanState) => void
): () => void {
  ipcMain.handle('racePlan:getState', () => service.getState());
  ipcMain.handle('racePlan:choosePlanning', (_event, planningId: unknown) =>
    service.choosePlanning(planningId)
  );
  ipcMain.handle('racePlan:setConfig', (_event, patch: unknown) =>
    service.setConfig(patch)
  );
  ipcMain.handle('racePlan:setApiKey', (_event, apiKey: unknown) =>
    service.setApiKey(apiKey)
  );
  ipcMain.handle('racePlan:clearApiKey', () => service.clearApiKey());
  ipcMain.handle('racePlan:listPlannings', () => service.listPlannings());
  ipcMain.handle('racePlan:refreshNow', () => service.refreshNow());
  return service.onChange(broadcast);
}

/** A window as the broadcast sees it: BrowserWindow in the app. */
export interface RacePlanWindow {
  isDestroyed(): boolean;
  isVisible(): boolean;
  webContents: {
    id: number;
    send(channel: string, state: RacePlanState): void;
  };
}

/**
 * Sends the state only to visible windows that subscribed to it. A hidden
 * subscriber is skipped and gets the latest state from `onShown`.
 */
export function createRacePlanBroadcast(
  isSubscribed: (rendererId: number) => boolean,
  windows: () => readonly RacePlanWindow[]
) {
  let latest: RacePlanState | undefined;
  const deliver = (window: RacePlanWindow) => {
    if (
      latest &&
      !window.isDestroyed() &&
      window.isVisible() &&
      isSubscribed(window.webContents.id)
    ) {
      window.webContents.send(RACE_PLAN_STATE_EVENT, latest);
    }
  };
  return {
    send(state: RacePlanState) {
      latest = state;
      windows().forEach(deliver);
    },
    onShown: deliver,
  };
}

/** Must run after `app.whenReady()`: safeStorage needs the app ready. */
export function setupRacePlanBridge() {
  const store = createRacePlanStore(
    path.join(app.getPath('userData'), 'race-plan.json')
  );
  const service = createRacePlanService({
    store,
    client: createIracePlanClient(),
    crypto: safeStorageCrypto,
  });
  setRacePlanSource(service);
  const watchedWindows = new Set<number>();
  const subscriptions = defineRendererSubscriptionBridge({
    name: 'racePlan',
    isValidKey: (value: unknown): value is 'state' => value === 'state',
    onSubscribe: (sender) => {
      const window = BrowserWindow.fromWebContents(sender);
      if (!window || watchedWindows.has(window.id)) return;
      const windowId = window.id;
      watchedWindows.add(windowId);
      window.on('show', () => broadcast.onShown(window));
      window.on('restore', () => broadcast.onShown(window));
      window.once('closed', () => watchedWindows.delete(windowId));
    },
  });
  const broadcast = createRacePlanBroadcast(
    (rendererId) => subscriptions.registry.has(rendererId, 'state'),
    () => BrowserWindow.getAllWindows()
  );
  const unsubscribe = registerRacePlanHandlers(service, broadcast.send);
  return {
    service,
    dispose: () => {
      setRacePlanSource(null);
      unsubscribe();
      subscriptions.dispose();
      service.dispose();
    },
    flush: async () => {
      await service.ready;
      await store.flush();
    },
  };
}
