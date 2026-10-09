import type { SimDefinition, SimProbe } from '../types';

// Higher than iRacing so a live LMU session wins when both sims are running.
const lmu: SimDefinition = {
  id: 'lmu',
  priority: 200,

  createProbe: async (): Promise<SimProbe> => {
    const { NativeLmu } = await import('../../../../irsdk/native/lmu');
    const sdk = new NativeLmu();
    return {
      start: () => {
        sdk.start();
      },
      isActive: () => {
        const frame = sdk.read();
        return (
          frame.running && frame.trackName.length > 0 && frame.numVehicles > 0
        );
      },
      stop: () => {
        sdk.stop();
      },
    };
  },

  loadBridge: async () => {
    const { publishIRacingSDKEvents } = await import('../../lmuSdkBridge');
    return publishIRacingSDKEvents;
  },
};

export default lmu;
