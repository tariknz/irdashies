import {
  FuelProjectionEngine,
  type FuelEngineCommand,
} from '../../src/shared/fuel';
import {
  isGreenFlag,
  validateLapData,
} from '../../src/frontend/components/FuelCalculator/fuelCalculations';
import type { ReplayProbe, TelemetryFrame } from './validator';

interface FuelProbeState {
  commands: readonly FuelEngineCommand[];
  state: ReturnType<FuelProjectionEngine['snapshot']>;
}

const numberValue = (frame: TelemetryFrame, name: string): number => {
  const value = frame[name];
  if (typeof value !== 'number') {
    throw new Error(`Fuel probe expected numeric telemetry variable: ${name}`);
  }
  return value;
};

export const createFuelStateProbe = (): ReplayProbe<FuelProbeState> => {
  let elapsedMilliseconds = 0;
  const engine = new FuelProjectionEngine(
    { now: () => elapsedMilliseconds },
    { debug: () => undefined }
  );
  const laps: FuelEngineCommand[] = [];
  let previousOnTrack = false;
  let previousOnPitRoad = false;
  let previousFlags: number | undefined;
  let checkpoint: string | undefined;

  return {
    name: 'fuel-state',
    schemaVersion: 1,
    variables: [
      'FuelLevel',
      'IsOnTrack',
      'Lap',
      'LapDistPct',
      'OnPitRoad',
      'PlayerCarTowTime',
      'SessionFlags',
      'SessionNum',
      'SessionTime',
    ],
    onFrame(frame, context) {
      elapsedMilliseconds = Math.round(context.elapsedSeconds * 1000);
      const onTrack = Boolean(frame.IsOnTrack);
      const onPitRoad = Boolean(frame.OnPitRoad);
      const flags = numberValue(frame, 'SessionFlags');
      const lap = numberValue(frame, 'Lap');
      const commands = engine.onFrame(
        {
          fuelLevel: numberValue(frame, 'FuelLevel'),
          lap,
          lapDistPct: numberValue(frame, 'LapDistPct'),
          onPitRoad,
          playerCarTowTime: numberValue(frame, 'PlayerCarTowTime'),
          sessionFlags: flags,
          sessionNum: numberValue(frame, 'SessionNum'),
          sessionTime: numberValue(frame, 'SessionTime'),
        },
        {
          getRecentLaps: (count) =>
            laps
              .filter(
                (
                  command
                ): command is Extract<
                  FuelEngineCommand,
                  { type: 'lapCompleted' }
                > => command.type === 'lapCompleted'
              )
              .map(({ lap: completedLap }) => completedLap)
              .slice(-count)
              .reverse(),
        },
        validateLapData,
        isGreenFlag,
        { persistLaps: false }
      );
      laps.push(...commands);

      checkpoint = undefined;
      if (onTrack && !previousOnTrack) checkpoint = 'onTrack:enter';
      else if (onPitRoad !== previousOnPitRoad)
        checkpoint = `pit:${onPitRoad ? 'enter' : 'exit'}:${lap}`;
      else if (commands.some(({ type }) => type === 'lapCompleted'))
        checkpoint = `lap:${lap - 1}`;
      else if (previousFlags !== undefined && flags !== previousFlags)
        checkpoint = `flags:${flags}`;
      previousOnTrack = onTrack;
      previousOnPitRoad = onPitRoad;
      previousFlags = flags;

      return {
        commands,
        state: engine.snapshot(),
      };
    },
    checkpoint() {
      return checkpoint;
    },
    onDisconnect() {
      engine.reset();
    },
  };
};
