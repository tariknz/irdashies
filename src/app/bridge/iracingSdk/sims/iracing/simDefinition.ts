import type { SimDefinition, SimProbe } from '../types';

/**
 * iRacing, the built-in telemetry source.
 *
 * Priority is the auto-detect tie-break, used only when more than one source
 * is running at once. 100 is the baseline a second source is measured against:
 * one that should win a tie gives itself a higher number, one that should
 * defer gives itself a lower one.
 *
 * It has nothing to do with being the only source in the tree -- with nothing
 * to choose between, `auto` resolves here without probing at all.
 */
const iracing: SimDefinition = {
  id: 'iracing',
  priority: 100,

  createProbe: async (): Promise<SimProbe> => {
    const { NativeSDK } = await import('../../../../irsdk/native');
    const sdk = new NativeSDK();
    return {
      start: () => sdk.startSDK(),
      // A zero timeout makes this a poll rather than a block: auto-detect is
      // looping over several sims and must not stall on one of them.
      isActive: () => sdk.waitForData(0),
      stop: () => sdk.stopSDK(),
    };
  },

  loadBridge: async () => {
    const { publishIRacingSDKEvents } = await import('../../iracingSdkBridge');
    return publishIRacingSDKEvents;
  },
};

export default iracing;
