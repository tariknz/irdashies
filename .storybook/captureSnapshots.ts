import type {
  ChannelName,
  ChannelPayloads,
  Session,
  Telemetry,
} from '@irdashies/types';
import { StandingsProcessor } from '../src/app/processors/StandingsProcessor';
import { RelativeGapProcessor } from '../src/app/processors/RelativeGapProcessor';
import { SessionBarProcessor } from '../src/app/processors/SessionBarProcessor';
import { TrackStateProcessor } from '../src/app/processors/TrackStateProcessor';
import { LapTimesProcessor } from '../src/app/processors/LapTimesProcessor';
import defaultSession from '../src/app/irsdk/node/utils/mock-data/session.json';
import defaultTelemetry from '../src/app/irsdk/node/utils/mock-data/telemetry.json';

/**
 * Channel snapshots generated from whichever capture a story loads.
 *
 * Stories drive two things from the same capture: the session, through
 * SessionProvider, and the channels, through window.channelBridge. Pinning the
 * channels to one capture while a story loads another makes the two disagree —
 * and a disagreement about which car is the player is enough to blank the
 * Relative widget entirely, because it centres its window on the channel's
 * focus car but finds the player row by a flag set from the session's.
 *
 * Generating both from the same source removes the whole class of problem.
 */

const first = <T>(value: T | T[]): T =>
  Array.isArray(value) ? value[0] : value;

/** No recorded reference laps in a fixture, so gaps use the class estimate. */
const noReferenceLaps = {
  snapshot: () => ({
    bestLaps: [],
    persistedLaps: [],
    sessionNum: null,
    version: 0,
  }),
};

const loadCapture = async (path?: string) => {
  if (!path) {
    return {
      session: defaultSession as unknown as Session,
      telemetry: defaultTelemetry as unknown as Telemetry,
    };
  }
  const telemetry = (await import(/* @vite-ignore */ `${path}/telemetry.json`))
    .default;
  const session = (await import(/* @vite-ignore */ `${path}/session.json`))
    .default;
  return {
    session: first(session) as Session,
    telemetry: first(telemetry) as Telemetry,
  };
};

export type CaptureSnapshots = Partial<
  Record<ChannelName, ChannelPayloads[ChannelName]>
>;

const cache = new Map<string, Promise<CaptureSnapshots>>();

/**
 * @param path A `/test-data/<id>` capture, or undefined for the default mock.
 */
export const buildCaptureSnapshots = (
  path?: string
): Promise<CaptureSnapshots> => {
  const key = path ?? '__default__';
  const existing = cache.get(key);
  if (existing) return existing;

  const built = loadCapture(path).then(({ session, telemetry }) => {
    const standings = new StandingsProcessor();
    const relativeGaps = new RelativeGapProcessor(noReferenceLaps);
    const sessionBar = new SessionBarProcessor();
    const trackState = new TrackStateProcessor();
    const lapTimes = new LapTimesProcessor();

    const processors = [
      standings,
      relativeGaps,
      sessionBar,
      trackState,
      lapTimes,
    ];
    for (const processor of processors) {
      processor.init?.(session);
      processor.onFrame(telemetry);
    }

    return {
      'standings.snapshot': standings.snapshot(),
      'relative-gaps.snapshot': relativeGaps.snapshot(),
      'session-bar.snapshot': sessionBar.snapshot(),
      'track-state.snapshot': trackState.snapshot(),
      'lap-times.snapshot': lapTimes.snapshot(),
    } as CaptureSnapshots;
  });

  cache.set(key, built);
  return built;
};
