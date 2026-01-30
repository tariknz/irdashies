/**
 * Data for a single lap's fuel consumption
 */
export interface FuelLapData {
  /** Lap number */
  lapNumber: number;
  /** Fuel consumed during this lap (liters) */
  fuelUsed: number;
  /** Lap time in seconds */
  lapTime: number;
  /** Whether this lap was under green flag conditions */
  isGreenFlag: boolean;
  /** Whether this lap is valid for calculations (outlier filtering) */
  isValidForCalc: boolean;
  /** Whether the car started this lap from pit road (out-lap) */
  isOutLap: boolean;
  /** Whether the car entered pit road during this lap (in-lap) */
  isInLap?: boolean;
  /** Whether the car was towed during this lap */
  wasTowed?: boolean;
  /** Whether this lap is from a previous session (historical) */
  isHistorical?: boolean;
  /** Timestamp when lap was completed */
  timestamp: number;
  /** Session number the lap was completed in */
  sessionNum?: number;
}

export interface FuelCalculatorBridge {
  /**
   * Get the last 10 laps for a specific track and car
   */
  getHistoricalLaps: (trackId: number, carName: string) => Promise<FuelLapData[]>;

  /**
   * Save a completed lap for a specific track and car
   */
  saveLap: (trackId: number, carName: string, lap: FuelLapData) => Promise<void>;

  /**
   * Clear history for a specific track and car
   */
  clearHistory: (trackId: number, carName: string) => Promise<void>;

  /**
   * Clear all fuel history from the database
   */
  clearAllHistory: () => Promise<void>;

  /**
   * Get qualifying max consumption for a specific track and car
   */
  getQualifyMax: (trackId: number, carName: string) => Promise<number | null>;

  /**
   * Save qualifying max consumption for a specific track and car
   */
  saveQualifyMax: (trackId: number, carName: string, val: number | null) => Promise<void>;
}
