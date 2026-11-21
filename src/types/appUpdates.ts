export const APP_UPDATE_PHASES = [
  'idle',
  'checking',
  'downloading',
  'ready',
  'restarting',
  'no-update',
  'error',
  'restart-error',
] as const;

export interface AppUpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  autoUpdate: boolean;
  preferenceSaveFailed: boolean;
  canUpdate: boolean;
  newerVersionAvailable: boolean;
  checkingLatest: boolean;
  latestCheckFailed: boolean;
  phase: (typeof APP_UPDATE_PHASES)[number];
}

export type AppUpdateAction = 'download' | 'restart';

export interface AppUpdatesBridge {
  onStatus: (callback: (status: AppUpdateStatus) => void) => () => void;
  checkLatest: () => Promise<void>;
  setAutoUpdate: (enabled: boolean) => Promise<void>;
  install: (action: AppUpdateAction) => Promise<void>;
}
