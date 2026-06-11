import { useSessionLapCount } from '../../components/Standings/hooks/useSessionLapCount';
import {
    useCurrentSessionType,
    useCarIdxClassEstLapTime,
    useFocusCarIdx,
    useTelemetryValue,
    useTelemetryValues,
    useTelemetryValuesRounded,
} from '@irdashies/context';
import { useCarIdxAverageLapTime } from './useCarIdxAverageLapTime';
import { SessionState } from '@irdashies/types';

// Estimate the total number of laps that will be completed by the drivers car in a timed session.
export const useTotalRaceValue = () => {
    const carIdx = useFocusCarIdx() as number;
    const { timeRemaining, timeTotal, totalLaps, state } = useSessionLapCount();
    const lap = useTelemetryValues('CarIdxLap')?.[carIdx] as number;
    const sessionType = useCurrentSessionType();
    const lapDistPct = useTelemetryValue('LapDistPct');
    const carIdxLap = useTelemetryValues('CarIdxLap');
    const carIdxPosition = useTelemetryValues('CarIdxPosition');
    const carIdxLapDistPct = useTelemetryValuesRounded('CarIdxLapDistPct', 3);
    const avgLapTimes = useCarIdxAverageLapTime();
    const bestLapTime = useTelemetryValues('CarIdxBestLapTime')?.[carIdx] as number | undefined;
    const classEstLapTimes = useCarIdxClassEstLapTime();
    const isFixedLapRace = !((timeRemaining > 0) && (timeRemaining !== 604800));
    const result = {
        isFixedLapRace: isFixedLapRace,
        totalRaceLaps: 0,
        totalRaceTime: 0,
        adjustedRaceTime: 0,
    };

    // No race, no business
    if (sessionType != 'Race') return result;

    let leaderCarIdx = -1;
    let leaderLap = 0;
    let leaderLapDistPct = 0;
    for (let i = 0; i < carIdxPosition.length; i++) {
        if (carIdxPosition[i] === 1) {
            leaderCarIdx = i;
            leaderLap = carIdxLap[i];
            leaderLapDistPct = carIdxLapDistPct[i];
            break;
        }
    }
    // When no leader found yet (pre-race), fall back to player's carIdx for lap time lookup
    const lapTimeCarIdx = leaderCarIdx >= 0 ? leaderCarIdx : carIdx;
    // Use P1's average lap time, falling back to class estimated lap time if no laps recorded yet
    // Use best lap time as last resort
    const avgLapTime =
        (avgLapTimes[lapTimeCarIdx] > 0)
            ? avgLapTimes[lapTimeCarIdx]
            : (classEstLapTimes?.[lapTimeCarIdx] ?? 0) > 0 && classEstLapTimes?.[lapTimeCarIdx] !== undefined
                ? classEstLapTimes?.[lapTimeCarIdx]
                : (bestLapTime ?? 0);


    if (isFixedLapRace) {
        // Easy case, fixed lap count. We just have to account for the race leader that might have lapped us
        result.totalRaceLaps = totalLaps;

        const lapsValid = lap !== undefined &&
            leaderLap !== undefined &&
            lapDistPct !== undefined &&
            leaderLapDistPct !== undefined &&
            lap > 0 &&
            leaderLap > 0

        if (lapsValid) {
            const totalDist = lap + lapDistPct;
            const totalLeaderDist = leaderLap + leaderLapDistPct;

            if (totalLeaderDist > totalDist) {
                result.totalRaceLaps -= Math.floor(totalLeaderDist - totalDist);
            }
        }

        if (avgLapTime > 0) {
            result.totalRaceTime = totalLaps * avgLapTime;
            result.adjustedRaceTime = result.totalRaceTime;

            if (lapsValid) {
                const totalDist = lap + lapDistPct;
                const totalLeaderDist = leaderLap + leaderLapDistPct;
                if (totalLeaderDist > totalDist) {
                    result.adjustedRaceTime =
                        (totalLaps - Math.floor(totalLeaderDist - totalDist)) * avgLapTime;
                }
            }
        }
    } else {
        // Time-limited race, so we have to estimate based on remaining time and expected laptimes
        // In replays, the average lap time is reported as 1s, which is obviously invalid, so we skip
        // the estimation in this case
        result.totalRaceTime = timeTotal;

        const classEstLapTime = classEstLapTimes?.[carIdx];
        const effectiveLapTime =
            avgLapTime !== undefined && avgLapTime > 1
                ? avgLapTime
                : classEstLapTime !== undefined && classEstLapTime > 1
                    ? classEstLapTime
                    : undefined;

        if (effectiveLapTime !== undefined) {
            if (lap === 0) {
                // Race has not yet started
                result.totalRaceLaps = timeTotal / effectiveLapTime;
            } else {
                // Race has started, so we have to add the number of completed laps and the percentage of the current lap
                result.totalRaceLaps =
                    timeRemaining / effectiveLapTime +
                    (leaderLap - 1) +
                    (leaderLapDistPct ?? 0);

                // Remove laps if not on the same lap as the leader
                const totalDist = lap;
                const totalLeaderDist = leaderLap;

                if (leaderLap > lap + 1) {
                    result.totalRaceLaps -= Math.floor(totalLeaderDist - totalDist);
                }
            }
        }

        if ((totalLaps ?? 0) > 0 && result.totalRaceLaps > totalLaps) {
            result.totalRaceLaps = totalLaps;
        }
    }

    if (state >= SessionState.Checkered) {
        // After checkered: freeze at the lap count captured when the flag was shown
        return {
            isFixedLapRace: isFixedLapRace,
            totalRaceLaps: lap,
            totalRaceTime: result.totalRaceTime,
            adjustedRaceTime: result.adjustedRaceTime
        };
    }

    return result;
};