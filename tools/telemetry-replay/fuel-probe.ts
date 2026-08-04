import type { Telemetry } from '../../src/types';
import { FuelProjectionProcessor } from '../../src/app/processors/FuelProjectionProcessor';
import type { ReplayProbe, TelemetryFrame } from './validator';

interface FuelProbeState {
  commands: ReturnType<
    FuelProjectionProcessor['validationSnapshot']
  >['commands'];
  state: ReturnType<FuelProjectionProcessor['validationSnapshot']>['state'];
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
  const processor = new FuelProjectionProcessor({
    clock: () => elapsedMilliseconds,
  });
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
      const telemetry = Object.fromEntries(
        Object.entries(frame).map(([name, entry]) => [name, { value: [entry] }])
      ) as unknown as Telemetry;
      processor.onFrame(telemetry);
      const validation = processor.validationSnapshot();
      const commands = validation.commands;

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
        state: validation.state,
      };
    },
    checkpoint() {
      return checkpoint;
    },
    onDisconnect() {
      processor.onLifecycle({ type: 'disconnect' });
    },
  };
};
