import { beforeEach, expect, it, vi } from 'vitest';
import {
  getStorageStatus,
  onStorageStatus,
  reportStorageResult,
} from './storageStatus';

beforeEach(() => {
  reportStorageResult('fuel');
  reportStorageResult('referenceLaps');
});

it('deduplicates across files and only recovers when every failed file saves', () => {
  const listener = vi.fn();
  const dispose = onStorageStatus(listener);
  const full = { code: 'ENOSPC' };
  reportStorageResult('fuel', full);
  reportStorageResult('fuel', full);
  reportStorageResult('referenceLaps', full);
  expect(listener).toHaveBeenCalledExactlyOnceWith({ diskFull: true });
  reportStorageResult('fuel');
  expect(getStorageStatus()).toEqual({ diskFull: true });
  reportStorageResult('referenceLaps');
  expect(listener).toHaveBeenLastCalledWith({ diskFull: false });
  expect(listener).toHaveBeenCalledTimes(2);
  reportStorageResult('fuel', full);
  expect(listener).toHaveBeenCalledTimes(3);
  dispose();
});

it('does not mislabel unexpected errors as disk full or claim recovery before a successful save', () => {
  reportStorageResult('fuel', { code: 'EACCES' });
  expect(getStorageStatus().diskFull).toBe(false);
  reportStorageResult('fuel', { code: 'ENOSPC' });
  reportStorageResult('fuel', { code: 'EIO' });
  expect(getStorageStatus().diskFull).toBe(true);
  reportStorageResult('fuel');
  expect(getStorageStatus().diskFull).toBe(false);
});
