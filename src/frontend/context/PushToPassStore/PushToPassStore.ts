import { create } from 'zustand';
import { getCarP2PConfig } from './carP2PConfigs';

export type P2PStatus = 'inactive' | 'active' | 'cooldown' | 'exhausted';

export interface P2PDisplayState {
  status: P2PStatus;
  count: number;
}

interface PushToPassState {
  sessionUniqId: number;
  sessionTime: number;
  /** SessionTime when cooldown expires per carIdx. null = not in cooldown. */
  cooldownEndTimes: (number | null)[];
  /** P2P_Status value from previous update frame per carIdx */
  prevP2PStatus: boolean[];
  update: (
    p2pStatus: boolean[],
    p2pCount: number[],
    carIdxToCarId: Record<number, number>,
    sessionTime: number,
    sessionUniqId: number
  ) => void;
  reset: () => void;
}

export const usePushToPassStore = create<PushToPassState>((set, get) => ({
  sessionUniqId: 0,
  sessionTime: 0,
  cooldownEndTimes: [],
  prevP2PStatus: [],

  update(p2pStatus, p2pCount, carIdxToCarId, sessionTime, sessionUniqId) {
    const {
      sessionUniqId: prevUniqId,
      cooldownEndTimes,
      prevP2PStatus,
    } = get();

    if (prevUniqId !== 0 && sessionUniqId !== prevUniqId) {
      set({
        sessionUniqId,
        sessionTime,
        cooldownEndTimes: [],
        prevP2PStatus: [],
      });
      return;
    }

    const newCooldownEndTimes = [...cooldownEndTimes];
    const newPrevP2PStatus = [...prevP2PStatus];

    p2pStatus.forEach((isActive, carIdx) => {
      const wasActive = prevP2PStatus[carIdx] ?? false;
      const count = p2pCount[carIdx] ?? 0;
      const carId = carIdxToCarId[carIdx];
      const config = carId !== undefined ? getCarP2PConfig(carId) : undefined;

      if (!config) {
        newPrevP2PStatus[carIdx] = isActive;
        return;
      }

      // Transition active → inactive: start cooldown (only if P2P not exhausted)
      if (wasActive && !isActive && count > 0) {
        newCooldownEndTimes[carIdx] = sessionTime + config.cooldownInterval;
      }

      // Cooldown expired
      const cooldownEnd = newCooldownEndTimes[carIdx];
      if (
        cooldownEnd !== null &&
        cooldownEnd !== undefined &&
        sessionTime >= cooldownEnd
      ) {
        newCooldownEndTimes[carIdx] = null;
      }

      newPrevP2PStatus[carIdx] = isActive;
    });

    set({
      sessionUniqId,
      sessionTime,
      cooldownEndTimes: newCooldownEndTimes,
      prevP2PStatus: newPrevP2PStatus,
    });
  },

  reset() {
    set({
      sessionUniqId: 0,
      sessionTime: 0,
      cooldownEndTimes: [],
      prevP2PStatus: [],
    });
  },
}));
