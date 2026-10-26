import { app, ipcMain, safeStorage, webContents } from 'electron';
import path from 'node:path';
import type { RacePlanState } from '@irdashies/types';
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
  const unsubscribe = registerRacePlanHandlers(service, (state) => {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) contents.send(RACE_PLAN_STATE_EVENT, state);
    }
  });
  return {
    service,
    dispose: () => {
      setRacePlanSource(null);
      unsubscribe();
      service.dispose();
    },
    flush: async () => {
      await service.ready;
      await store.flush();
    },
  };
}
