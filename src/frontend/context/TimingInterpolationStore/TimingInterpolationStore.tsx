import React, { createContext, useContext, useRef, useEffect, useState } from 'react';
import {
  useSessionStore,
  useTelemetryValues,
} from '@irdashies/context';
import { SessionState } from '@irdashies/types';
import { 
  TimingInterpolationStore,
  CarClassTimingData,
  CarRecordingState
} from './types';
import { 
  getTimeByDistance,
  calculateTimeDelta,
  processCompletedLap
} from './interpolation';

const TimingInterpolationContext = createContext<TimingInterpolationStore | null>(null);

interface TimingInterpolationProviderProps {
  children: React.ReactNode;
}

export const TimingInterpolationProvider: React.FC<TimingInterpolationProviderProps> = ({
  children,
}) => {
  // Telemetry data
  const sessionTime = useTelemetryValues('SessionTime')?.[0];
  const carIdxLapDistPct = useTelemetryValues<number[]>('CarIdxLapDistPct');
  const carIdxLap = useTelemetryValues<number[]>('CarIdxLap');
  const carIdxOnPitRoad = useTelemetryValues<boolean[]>('CarIdxOnPitRoad');
  const sessionStateArray = useTelemetryValues('SessionState');
  const sessionState = sessionStateArray?.[0];
  
  // Session data
  const drivers = useSessionStore(s => s.session?.DriverInfo?.Drivers);
  const trackId = useSessionStore(s => s.session?.WeekendInfo?.TrackID);
  const sessionNumArray = useTelemetryValues('SessionNum');
  const sessionNum = sessionNumArray?.[0];

  // Store state
  const bestLapByCarClass = useRef(new Map<number, CarClassTimingData>());
  const recordingState = useRef(new Map<number, CarRecordingState>());
  const [isRecording, setIsRecording] = useState(false);

  // Hybrid sampling configuration
  const minDistanceGap = 0.005; // 0.5% of track
  const minTimeGap = 0.2; // 200ms minimum between records
  const maxTimeGap = 1.0; // 1 second maximum between records

  // Clear data when session changes and update recording state
  useEffect(() => {
    if (sessionNum !== undefined) {
      bestLapByCarClass.current.clear();
      recordingState.current.clear();
    }
    
    // Only mark as recording during actual racing
    setIsRecording(sessionState === SessionState.Racing);
  }, [sessionNum, trackId, sessionState]);

  // Main recording loop
  useEffect(() => {
    if (!carIdxLapDistPct || !sessionTime || !drivers || !carIdxLap) {
      return;
    }

    // Only record timing data during actual racing, not pace laps or other states
    // This prevents corrupted interpolation from pace lap speeds being mixed with racing speeds
    if (sessionState !== SessionState.Racing) {
      return;
    }

    const currentTime = sessionTime;
    
    Object.entries(carIdxLapDistPct).forEach(([carIdxStr, distPct]) => {
      const carIdx = parseInt(carIdxStr);
      
      // Skip if invalid distance
      if (distPct < 0 || distPct > 1) return;
      
      // Find driver info
      const driver = drivers.find(d => d.CarIdx === carIdx);
      if (!driver || driver.CarIsPaceCar || driver.IsSpectator) return;
      
      // Check if on pit road or session not active
      const onPitRoad = carIdxOnPitRoad?.[carIdx] ?? false;
      const isRacing = sessionState === 4 || sessionState === 5; // GREEN or CHECKERED
      
      if (onPitRoad || !isRacing) {
        // Reset recording for this car
        recordingState.current.delete(carIdx);
        return;
      }

      // Get or create recording state for this car
      const currentLap = carIdxLap[carIdx] ?? 0;
      let state = recordingState.current.get(carIdx);
      
      if (!state) {
        state = {
          carIdx,
          currentLap,
          lastDist: distPct,
          lastTime: currentTime,
          timingPoints: [],
          carClassId: driver.CarClassID,
          isLapStarted: false,
          isRecording: false,
        };
        recordingState.current.set(carIdx, state);
      }

      // Check for lap change
      if (currentLap !== state.currentLap) {
        // Process completed lap if we have enough data
        if (state.timingPoints.length > 0 && state.isLapStarted) {
          const success = processCompletedLap(
            state.timingPoints,
            state.carClassId,
            sessionNum ?? 0,
            trackId ?? 0,
            bestLapByCarClass.current
          );
          
          if (success) {
            console.log(`New best lap for class ${state.carClassId}: ${bestLapByCarClass.current.get(state.carClassId)?.lapTime?.toFixed(3)}s`);
          }
        }

        // Reset for new lap
        state.currentLap = currentLap;
        state.timingPoints = [];
        state.isLapStarted = false;
        state.isRecording = false;
      }

      // Check if we should record this data point
      const timeSinceLastRecord = currentTime - state.lastTime;
      const distanceMoved = Math.abs(distPct - state.lastDist);
      const wrappedDistance = Math.min(distanceMoved, 1 - distanceMoved);

      const shouldRecord = 
        wrappedDistance >= minDistanceGap || 
        timeSinceLastRecord >= minTimeGap ||
        timeSinceLastRecord >= maxTimeGap;

      if (shouldRecord) {
        // Detect lap start (crossing from high to low distance percentage)
        if (!state.isLapStarted && state.lastDist > 0.9 && distPct < 0.1) {
          state.isLapStarted = true;
          state.isRecording = true;
          state.timingPoints = []; // Start fresh
        }

        // Record timing point if we're recording
        if (state.isRecording || state.isLapStarted) {
          state.timingPoints.push({
            dist: distPct,
            time: currentTime,
          });
        }

        // Update state
        state.lastDist = distPct;
        state.lastTime = currentTime;
      }
    });
  }, [
    carIdxLapDistPct, 
    sessionTime, 
    carIdxLap, 
    carIdxOnPitRoad, 
    sessionState, 
    drivers, 
    sessionNum, 
    trackId,
    minDistanceGap,
    minTimeGap,
    maxTimeGap
  ]);

  // Store interface implementation
  const store: TimingInterpolationStore = {
    bestLapByCarClass: bestLapByCarClass.current,
    
    getTimeByDistance: (carClassId: number, dist: number) => {
      const record = bestLapByCarClass.current.get(carClassId);
      return record ? getTimeByDistance(record, dist) : null;
    },
    
    getTimeDelta: (
      playerCarIdx: number,
      otherCarIdx: number,
      playerDist: number,
      otherDist: number,
      driversData: { carIdx: number; carClass?: { id?: number; estLapTime?: number } }[]
    ) => {
      return calculateTimeDelta(
        bestLapByCarClass.current,
        playerCarIdx,
        otherCarIdx,
        playerDist,
        otherDist,
        driversData
      );
    },
    
    clearTimingData: () => {
      bestLapByCarClass.current.clear();
      recordingState.current.clear();
    },
    
    isRecording,
    
    getStats: () => {
      const bestLapTimes: Record<number, number> = {};
      const dataPoints: Record<number, number> = {};
      
      bestLapByCarClass.current.forEach((record, carClassId) => {
        bestLapTimes[carClassId] = record.lapTime;
        dataPoints[carClassId] = record.items.length;
      });
      
      return {
        totalCarClasses: bestLapByCarClass.current.size,
        bestLapTimes,
        dataPoints,
      };
    },
  };

  return (
    <TimingInterpolationContext.Provider value={store}>
      {children}
    </TimingInterpolationContext.Provider>
  );
};

export const useTimingInterpolation = (): TimingInterpolationStore => {
  const context = useContext(TimingInterpolationContext);
  if (!context) {
    throw new Error('useTimingInterpolation must be used within a TimingInterpolationProvider');
  }
  return context;
};
