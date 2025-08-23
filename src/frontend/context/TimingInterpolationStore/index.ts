export { TimingInterpolationProvider, useTimingInterpolation } from './TimingInterpolationStore';
export type { 
  TimingInterpolationStore,
  TimingDataPoint,
  CarClassTimingData,
  CarRecordingState
} from './types';
export {
  getTimeByDistance,
  calculateTimeDelta,
  processCompletedLap
} from './interpolation';
