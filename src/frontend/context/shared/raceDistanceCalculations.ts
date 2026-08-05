/** Minimum plausible race lap time, including short oval configurations. */
export const MIN_VALID_RACE_LAP_TIME = 10;

export const isValidRaceLapTime = (
  lapTime: number | null | undefined
): lapTime is number =>
  lapTime !== null &&
  lapTime !== undefined &&
  Number.isFinite(lapTime) &&
  lapTime >= MIN_VALID_RACE_LAP_TIME;

export const selectRaceLapTime = (
  primaryAverage: number | null | undefined,
  primaryClassEstimate: number | null | undefined,
  primaryBest: number | null | undefined,
  fallbackAverage: number | null | undefined,
  fallbackClassEstimate: number | null | undefined,
  fallbackBest: number | null | undefined
): number | null => {
  if (isValidRaceLapTime(primaryAverage)) return primaryAverage;
  if (isValidRaceLapTime(primaryClassEstimate)) return primaryClassEstimate;
  if (isValidRaceLapTime(primaryBest)) return primaryBest;
  if (isValidRaceLapTime(fallbackAverage)) return fallbackAverage;
  if (isValidRaceLapTime(fallbackClassEstimate)) return fallbackClassEstimate;
  if (isValidRaceLapTime(fallbackBest)) return fallbackBest;

  return null;
};

export interface TimedRaceDistanceEstimate {
  totalRaceLaps: number;
  lapsRemaining: number;
}

export const calculateTimedRaceDistance = (
  timeRemaining: number,
  lapTime: number,
  playerLap: number,
  playerLapDistPct: number,
  leaderLap: number,
  leaderLapDistPct: number
): TimedRaceDistanceEstimate | null => {
  if (
    !isValidRaceLapTime(lapTime) ||
    !Number.isFinite(timeRemaining) ||
    timeRemaining < 0
  ) {
    return null;
  }

  const playerProgress = Math.max(0, playerLap - 1) + playerLapDistPct;
  const leaderProgress =
    Math.max(0, leaderLap - 1) + Math.max(0, leaderLapDistPct);
  const lapsBehind =
    leaderLap > playerLap + 1 ? Math.floor(leaderLap - playerLap) : 0;
  const totalRaceLaps = timeRemaining / lapTime + leaderProgress - lapsBehind;
  const finishLap = Math.ceil(totalRaceLaps);

  return {
    totalRaceLaps,
    lapsRemaining: Math.max(0, finishLap - playerProgress),
  };
};
