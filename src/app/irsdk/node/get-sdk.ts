import { platform } from 'os';

import type { INativeSDK } from '../native';

import { MockSDK } from './utils/mock-sdk';

export async function getSdkOrMock(): Promise<INativeSDK> {
  if (process.env.IRDASHIES_TELEMETRY_REPLAY || platform() === 'win32') {
    const Sdk = (await import('../native')).NativeSDK;
    return new Sdk();
  }
  return new MockSDK();
}
