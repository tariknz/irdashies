import { createHash } from 'node:crypto';

import {
  sha256File,
  TapeReader,
  type TapeRecord,
  type TapeVariable,
} from './tape';

export type TelemetryValue = boolean | number | string | readonly number[];
export type TelemetryFrame = Readonly<Record<string, TelemetryValue>>;

export interface ReplayFrameContext {
  sourceTick: number;
  elapsedTicks: bigint;
  elapsedSeconds: number;
  sessionTime?: number;
}

export interface ReplayProbe<State> {
  readonly name: string;
  readonly schemaVersion: number;
  readonly variables: readonly string[];
  onSessionInfo?(yaml: string, context: ReplayFrameContext): void;
  onFrame(frame: TelemetryFrame, context: ReplayFrameContext): State;
  checkpoint?(
    state: State,
    frame: TelemetryFrame,
    context: ReplayFrameContext
  ): string | undefined;
  onDisconnect?(context: ReplayFrameContext): void;
}

export interface ReplayMetadata {
  sha256: string;
  formatVersion: number;
  sdkVersion: number;
  tickRateHz: number;
  variableCount: number;
  frameBytes: number;
  mappingBytes: number;
  recordCount: number;
  frameCount: number;
  sessionUpdateCount: number;
  gapCount: number;
}

export interface ReplayProbeResult {
  name: string;
  schemaVersion: number;
  frameCount: number;
  rollingHash: string;
  checkpoints: Record<string, unknown>;
}

export interface ReplayValidationResult {
  metadata: ReplayMetadata;
  disconnectCount: number;
  endCount: number;
  appliedSessionUpdateCount: number;
  probes: ReplayProbeResult[];
}

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return JSON.stringify(String(value));
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)
  );
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`;
};

const decodeVariable = (
  payload: Buffer,
  variable: TapeVariable
): TelemetryValue => {
  const readAt = (index: number): number | boolean => {
    const offset = variable.offset + index * [1, 1, 4, 4, 4, 8][variable.type];
    switch (variable.type) {
      case 1:
        return payload.readInt8(offset) !== 0;
      case 2:
        return payload.readInt32LE(offset);
      case 3:
        return payload.readUInt32LE(offset);
      case 4:
        return payload.readFloatLE(offset);
      case 5:
        return payload.readDoubleLE(offset);
      default:
        return payload.readInt8(offset);
    }
  };
  if (variable.type === 0) {
    const bytes = payload.subarray(
      variable.offset,
      variable.offset + variable.count
    );
    const end = bytes.indexOf(0);
    return bytes.subarray(0, end === -1 ? bytes.length : end).toString('utf8');
  }
  if (variable.count === 1) return readAt(0);
  return Array.from({ length: variable.count }, (_, index) =>
    Number(readAt(index))
  );
};

const contextFor = (
  record: TapeRecord,
  qpcFrequency: bigint
): ReplayFrameContext => ({
  sourceTick: record.sourceTick,
  elapsedTicks: record.elapsedTicks,
  elapsedSeconds: Number(record.elapsedTicks) / Number(qpcFrequency),
});

export interface ValidateReplayOptions {
  path: string;
  expected?: Partial<ReplayMetadata>;
  probes: readonly ReplayProbe<unknown>[];
  sessionPollMilliseconds?: number;
}

export async function validateReplay({
  path,
  expected,
  probes,
  sessionPollMilliseconds = 500,
}: ValidateReplayOptions): Promise<ReplayValidationResult> {
  const [sha256, reader] = await Promise.all([
    sha256File(path),
    TapeReader.open(path),
  ]);
  const { header, variables } = reader.schema;
  const requestedNames = new Set(
    probes.flatMap((probe) => [...probe.variables])
  );
  const requestedVariables = [...requestedNames].map((name) => {
    const variable = variables.get(name);
    if (!variable)
      throw new Error(`Replay probe requested unknown variable: ${name}`);
    return variable;
  });
  const runtimes = probes.map((probe) => ({
    probe,
    hash: createHash('sha256'),
    frameCount: 0,
    checkpoints: {} as Record<string, unknown>,
  }));

  let records = 0;
  let frames = 0;
  let sessionUpdates = 0;
  let appliedSessionUpdates = 0;
  let gaps = 0;
  let disconnects = 0;
  let ends = 0;
  let pendingSession: TapeRecord | undefined;
  let nextSessionPoll = 0n;
  const pollTicks =
    (header.qpcFrequency * BigInt(sessionPollMilliseconds)) / 1000n;
  if (pollTicks <= 0n) {
    throw new Error('Session polling interval is shorter than one tape tick');
  }

  const applyPendingSession = (atTicks: bigint): void => {
    if (!pendingSession) return;
    const context = contextFor(
      { ...pendingSession, elapsedTicks: atTicks },
      header.qpcFrequency
    );
    const yaml = pendingSession.payload.toString('utf8').replace(/\0+$/, '');
    for (const runtime of runtimes) {
      runtime.probe.onSessionInfo?.(yaml, context);
      runtime.checkpoints[`session:${appliedSessionUpdates}`] = {
        sourceTick: pendingSession.sourceTick,
        elapsedSeconds: context.elapsedSeconds,
        revision: pendingSession.value,
      };
    }
    appliedSessionUpdates += 1;
    pendingSession = undefined;
  };

  try {
    while (true) {
      const record = await reader.readRecord();
      if (!record) break;
      records += 1;
      // Session data is sampled like production: a revision on a poll boundary
      // is visible immediately; between boundaries, only the latest pending
      // revision survives until the next poll.
      while (
        record.kind === 'sessionInfo'
          ? nextSessionPoll < record.elapsedTicks
          : nextSessionPoll <= record.elapsedTicks
      ) {
        applyPendingSession(nextSessionPoll);
        nextSessionPoll += pollTicks;
      }
      const context = contextFor(record, header.qpcFrequency);

      switch (record.kind) {
        case 'sessionInfo':
          sessionUpdates += 1;
          pendingSession = record;
          while (nextSessionPoll <= record.elapsedTicks) {
            applyPendingSession(nextSessionPoll);
            nextSessionPoll += pollTicks;
          }
          break;
        case 'frame': {
          frames += 1;
          const frame: Record<string, TelemetryValue> = {};
          for (const variable of requestedVariables) {
            frame[variable.name] = decodeVariable(record.payload, variable);
          }
          context.sessionTime =
            typeof frame.SessionTime === 'number'
              ? frame.SessionTime
              : undefined;
          for (const runtime of runtimes) {
            const probeFrame = Object.fromEntries(
              runtime.probe.variables.map((name) => [name, frame[name]])
            );
            const state = runtime.probe.onFrame(probeFrame, context);
            const frameHash = createHash('sha256')
              .update(canonicalJson(state))
              .digest('hex');
            runtime.hash.update(frameHash);
            runtime.frameCount += 1;
            if (runtime.frameCount === 1)
              runtime.checkpoints.firstFrame = state;
            const checkpoint = runtime.probe.checkpoint?.(
              state,
              probeFrame,
              context
            );
            if (checkpoint) runtime.checkpoints[checkpoint] = state;
            runtime.checkpoints.lastFrame = state;
          }
          break;
        }
        case 'gap':
          gaps += 1;
          break;
        case 'disconnect':
          disconnects += 1;
          for (const runtime of runtimes) runtime.probe.onDisconnect?.(context);
          break;
        case 'end':
          ends += 1;
          break;
      }
    }
    applyPendingSession(nextSessionPoll);
  } finally {
    await reader.close();
  }

  const metadata: ReplayMetadata = {
    sha256,
    formatVersion: header.formatVersion,
    sdkVersion: header.sdkVersion,
    tickRateHz: header.tickRate,
    variableCount: header.variableCount,
    frameBytes: header.frameSize,
    mappingBytes: Number(header.mappingSize),
    recordCount: records,
    frameCount: frames,
    sessionUpdateCount: sessionUpdates,
    gapCount: gaps,
  };
  if (BigInt(records) !== header.recordCount) {
    throw new Error(
      `Record count mismatch: header=${header.recordCount}, actual=${records}`
    );
  }
  if (ends !== 1)
    throw new Error(`Expected exactly one end record, found ${ends}`);
  for (const [key, value] of Object.entries(expected ?? {})) {
    if (metadata[key as keyof ReplayMetadata] !== value) {
      throw new Error(
        `Replay metadata mismatch for ${key}: expected=${String(value)}, actual=${String(
          metadata[key as keyof ReplayMetadata]
        )}`
      );
    }
  }

  return {
    metadata,
    disconnectCount: disconnects,
    endCount: ends,
    appliedSessionUpdateCount: appliedSessionUpdates,
    probes: runtimes.map((runtime) => ({
      name: runtime.probe.name,
      schemaVersion: runtime.probe.schemaVersion,
      frameCount: runtime.frameCount,
      rollingHash: runtime.hash.digest('hex'),
      checkpoints: runtime.checkpoints,
    })),
  };
}

export const telemetryStateProbe: ReplayProbe<Record<string, TelemetryValue>> =
  {
    name: 'telemetry-state',
    schemaVersion: 1,
    variables: [
      'SessionTime',
      'SessionTick',
      'FuelLevel',
      'Lap',
      'LapCompleted',
      'IsOnTrack',
      'PlayerCarPosition',
      'PlayerTrackSurface',
    ],
    onFrame(frame) {
      return frame;
    },
  };
