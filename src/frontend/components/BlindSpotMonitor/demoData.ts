import { CarLeftRight } from '@irdashies/types';

export interface BlindSpotDemoState {
  show: boolean;
  leftState: CarLeftRight;
  rightState: CarLeftRight;
  leftPercent: number;
  rightPercent: number;
  disableTransition: boolean;
}

const PHASE_S = 3;

/**
 * Cycles left/right occupancy and approach % so both standard and simple
 * indicator modes visibly change in demo mode.
 */
export const getDemoBlindSpotState = (
  elapsedSec = 0
): BlindSpotDemoState => {
  const phase = Math.floor(elapsedSec / PHASE_S) % 4;
  const within = (elapsedSec % PHASE_S) / PHASE_S;
  const approach = Math.round(within * 100);

  switch (phase) {
    case 0:
      return {
        show: true,
        leftState: CarLeftRight.CarLeft,
        rightState: CarLeftRight.Clear,
        leftPercent: approach,
        rightPercent: 0,
        disableTransition: false,
      };
    case 1:
      return {
        show: true,
        leftState: CarLeftRight.Cars2Left,
        rightState: CarLeftRight.CarRight,
        leftPercent: 100 - approach,
        rightPercent: approach,
        disableTransition: false,
      };
    case 2:
      return {
        show: true,
        leftState: CarLeftRight.Clear,
        rightState: CarLeftRight.Cars2Right,
        leftPercent: 0,
        rightPercent: approach,
        disableTransition: false,
      };
    default:
      return {
        show: true,
        leftState: CarLeftRight.CarLeft,
        rightState: CarLeftRight.CarRight,
        leftPercent: approach,
        rightPercent: 100 - approach,
        disableTransition: false,
      };
  }
};
