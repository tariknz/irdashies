import type { Telemetry } from '../../src/types';
import { FuelProjectionProcessor } from '../../src/app/processors/FuelProjectionProcessor';
import type { ReplayProbe, TelemetryFrame } from './validator';
import { ranLastFrame, rateLimited } from './rateLimited';

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
  const processor = rateLimited(
    new FuelProjectionProcessor({
      clock: () => elapsedMilliseconds,
    })
  );
  let previousOnTrack = false;
  let previousOnPitRoad = false;
  let previousFlags: number | undefined;
  let checkpoint: string | undefined;
  // An event seen on a frame the rate-limited processor skipped is held until
  // the processor runs, so the checkpoint records the state after the event.
  let pendingCheckpoint: string | undefined;

  return {
    name: 'fuel-state',
    schemaVersion: 1,
    variables: [
      'SessionTick',
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
      // Commands belong to the frame the processor ran on; on skipped frames
      // the snapshot still holds them, which would repeat lap checkpoints.
      const commands = ranLastFrame(processor) ? validation.commands : [];

      let event: string | undefined;
      if (onTrack && !previousOnTrack) event = 'onTrack:enter';
      else if (onPitRoad !== previousOnPitRoad)
        event = `pit:${onPitRoad ? 'enter' : 'exit'}:${lap}`;
      else if (previousFlags !== undefined && flags !== previousFlags)
        event = `flags:${flags}`;
      pendingCheckpoint ??= event;

      checkpoint = undefined;
      if (ranLastFrame(processor)) {
        checkpoint =
          pendingCheckpoint ??
          (commands.some(({ type }) => type === 'lapCompleted')
            ? `lap:${lap - 1}`
            : undefined);
        pendingCheckpoint = undefined;
      }
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
