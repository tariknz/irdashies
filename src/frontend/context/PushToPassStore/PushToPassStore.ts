import { create } from 'zustand';
import { getCarP2PConfig } from './carP2PConfigs';

// Other cars report CarIdxP2P_Count as IEEE-754 float32 bits despite varType=2 (int).
// The decoded float is in 0.1s units, so multiply by 10 to get seconds.
// The player's own car reports it as a plain integer (already in seconds) — no conversion needed.
const parseP2PCount = (bits: number, isPlayer: boolean): number => {
  if (isPlayer) return bits;
  const view = new DataView(new ArrayBuffer(4));
  view.setInt32(0, bits, true);
  return Math.round(view.getFloat32(0, true) * 10);
};

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
  /** Computed display state per carIdx. undefined = car does not support P2P. */
  displayStates: (P2PDisplayState | undefined)[];
  update: (
    p2pStatus: boolean[],
    p2pCount: number[],
    carIdxToCarId: Record<number, number>,
    sessionTime: number,
    sessionUniqId: number,
    playerCarIdx: number | undefined
  ) => void;
  reset: () => void;
}

export const usePushToPassStore = create<PushToPassState>((set, get) => ({
  sessionUniqId: 0,
  sessionTime: 0,
  cooldownEndTimes: [],
  prevP2PStatus: [],
  displayStates: [],

  update(
    p2pStatus,
    p2pCount,
    carIdxToCarId,
    sessionTime,
    sessionUniqId,
    playerCarIdx
  ) {
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
        displayStates: [],
      });
      return;
    }

    const newCooldownEndTimes = [...cooldownEndTimes];
    const newPrevP2PStatus = [...prevP2PStatus];

    p2pStatus.forEach((isActive, carIdx) => {
      const wasActive = prevP2PStatus[carIdx] ?? false;
      const count = parseP2PCount(
        p2pCount[carIdx] ?? 0,
        carIdx === playerCarIdx
      );
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

    const maxIdx = Math.max(p2pStatus.length, p2pCount.length);
    const newDisplayStates: (P2PDisplayState | undefined)[] = [];

    for (let carIdx = 0; carIdx < maxIdx; carIdx++) {
      const carId = carIdxToCarId[carIdx];
      const config = carId !== undefined ? getCarP2PConfig(carId) : undefined;

      if (!config) {
        newDisplayStates[carIdx] = undefined;
        continue;
      }

      const rawCount = p2pCount[carIdx] ?? -1;
      if (rawCount < 0) {
        newDisplayStates[carIdx] = undefined;
        continue;
      }

      const count = parseP2PCount(rawCount, carIdx === playerCarIdx);
      const isActive = p2pStatus[carIdx] ?? false;
      const cooldownEnd = newCooldownEndTimes[carIdx] ?? null;

      let status: P2PDisplayState['status'];
      if (count <= 0) {
        status = 'exhausted';
      } else if (isActive) {
        status = 'active';
      } else if (cooldownEnd !== null && sessionTime < cooldownEnd) {
        status = 'cooldown';
      } else {
        status = 'inactive';
      }

      newDisplayStates[carIdx] = { status, count };
    }

    set({
      sessionUniqId,
      sessionTime,
      cooldownEndTimes: newCooldownEndTimes,
      prevP2PStatus: newPrevP2PStatus,
      displayStates: newDisplayStates,
    });
  },

  reset() {
    set({
      sessionUniqId: 0,
      sessionTime: 0,
      cooldownEndTimes: [],
      prevP2PStatus: [],
      displayStates: [],
    });
  },
}));
