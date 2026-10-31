import { EventEmitter } from 'node:events';
import type { StorageStatus } from '../../types/storageStatus';

type StorageSource = 'fuel' | 'referenceLaps';
const diskFullSources = new Set<StorageSource>();
const events = new EventEmitter();

export const storageErrorCode = (error: unknown): string => {
  if (error && typeof error === 'object' && 'code' in error) {
    return typeof error.code === 'string' ? error.code : 'UNKNOWN';
  }
  return 'UNKNOWN';
};

export const getStorageStatus = (): StorageStatus => ({
  diskFull: diskFullSources.size > 0,
});

export const reportStorageResult = (
  source: StorageSource,
  error?: unknown
): void => {
  const wasFull = diskFullSources.size > 0;
  if (error === undefined) diskFullSources.delete(source);
  else if (storageErrorCode(error) === 'ENOSPC') diskFullSources.add(source);
  const diskFull = diskFullSources.size > 0;
  if (wasFull !== diskFull) {
    events.emit('status', getStorageStatus());
  }
};

export const onStorageStatus = (
  callback: (status: StorageStatus) => void
): (() => void) => {
  events.on('status', callback);
  return () => events.off('status', callback);
};
