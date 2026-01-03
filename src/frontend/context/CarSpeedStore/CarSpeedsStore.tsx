import type { Telemetry } from '@irdashies/types';
import { create, useStore } from 'zustand';

export interface CarSpeedBuffer {
  lastLapDistPct: number[];
  lastSessionTime: number;
  speedHistory: number[][]; // [carIdx][sample]
}

interface CarSpeedsState {
  carSpeedBuffer: CarSpeedBuffer | null;
  lastSpeedUpdate: number;
  carSpeeds: number[];
  updateCarSpeeds: (telemetry: Telemetry | null, trackLength: number) => void;
}

const SPEED_AVG_WINDOW = 5;
const SPEED_UPDATE_INTERVAL = 0.1; // Update interval in seconds

export const useCarSpeedsStore = create<CarSpeedsState>((set, get) => ({
  carSpeedBuffer: null,
  lastSpeedUpdate: 0,
  carSpeeds: [],
  updateCarSpeeds: (telemetry, trackLength) => {
    const { carSpeedBuffer, lastSpeedUpdate } = get();
    const sessionTime = telemetry?.SessionTime?.value?.[0] ?? 0;
    
    // Check if enough simulation time has passed since last update
    if (sessionTime - lastSpeedUpdate < SPEED_UPDATE_INTERVAL) {
      return;
    }

    const carIdxLapDistPct = telemetry?.CarIdxLapDistPct?.value ?? [];
    if (!carIdxLapDistPct.length || !trackLength) {
      set({ carSpeeds: carIdxLapDistPct.map(() => 0) });
      return;
    }
    const newHistory: number[][] = carSpeedBuffer?.speedHistory
      ? carSpeedBuffer.speedHistory.map(arr => [...arr])
      : carIdxLapDistPct.map(() => []);
    if (
      carSpeedBuffer &&
      carSpeedBuffer.lastLapDistPct.length === carIdxLapDistPct.length &&
      sessionTime !== carSpeedBuffer.lastSessionTime
    ) {
      const deltaTime = sessionTime - carSpeedBuffer.lastSessionTime;
      carIdxLapDistPct.forEach((pct, idx) => {
        const prevPct = carSpeedBuffer.lastLapDistPct[idx];
        let distancePercent = pct - prevPct;
        if (distancePercent < 0) distancePercent += 1.0; // wrap-around
        const distance = trackLength * distancePercent; // meters
        const speed = deltaTime > 0 ? (distance / deltaTime) * 3.6 : 0; // m/s to km/h
        if (!newHistory[idx]) newHistory[idx] = [];
        newHistory[idx].push(speed);
        if (newHistory[idx].length > SPEED_AVG_WINDOW) newHistory[idx].shift();
      });
    }
    // Calculate moving average for each car
    const avgSpeeds = newHistory.map(arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
    set({
      carSpeedBuffer: {
        lastLapDistPct: [...carIdxLapDistPct],
        lastSessionTime: sessionTime,
        speedHistory: newHistory,
      },
      lastSpeedUpdate: sessionTime,
      carSpeeds: avgSpeeds,
    });
  },
}));

export const useCarSpeeds = (): number[] => useStore(useCarSpeedsStore, (state) => state.carSpeeds); 