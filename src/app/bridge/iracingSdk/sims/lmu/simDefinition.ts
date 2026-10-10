import type { SimDefinition, SimProbe } from '../types';

/**
 * Le Mans Ultimate, read through its shared-memory map.
 *
 * Priority sits below iRacing's 100, so iRacing takes any tie: with both sims
 * reading as active at once, the one this app was built around is the safer
 * guess at which the driver is actually sitting in.
 */
const lmu: SimDefinition = {
  id: 'lmu',
  priority: 90,

  createProbe: async (): Promise<SimProbe> => {
    const { NativeLmu } = await import('../../../../lmu/native');
    const sdk = new NativeLmu();
    return {
      start: () => sdk.start(),
      isActive: () => {
        const frame = sdk.read();
        return (
          frame.running && frame.trackName.length > 0 && frame.numVehicles > 0
        );
      },
      stop: () => sdk.stop(),
    };
  },

  loadBridge: async () => {
    const { publishLmuSDKEvents } = await import('../../lmuSdkBridge');
    return publishLmuSDKEvents;
  },
};

export default lmu;
