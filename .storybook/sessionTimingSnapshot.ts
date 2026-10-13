import type {
  Session,
  SessionTimingSnapshot,
  Telemetry,
} from '@irdashies/types';
import { SessionTimingProcessor } from '../src/app/processors/SessionTimingProcessor';
import sessionFixture from '../src/app/irsdk/node/utils/mock-data/session.json';
import telemetryFixture from '../src/app/irsdk/node/utils/mock-data/telemetry.json';

/** iRacing's "no time limit" value for SessionTimeRemain, in seconds. */
const UNLIMITED_SESSION_TIME = 604800;

const RACE_SESSION_NUM = 2;

const buildSnapshot = (
  session: Session,
  telemetry: Telemetry
): SessionTimingSnapshot => {
  const processor = new SessionTimingProcessor();
  processor.init(session);
  processor.onFrame(telemetry);
  return processor.snapshot();
};

const withTelemetry = (
  overrides: Partial<Record<keyof Telemetry, number>>
): Telemetry => {
  const base = telemetryFixture as unknown as Telemetry;
  const patched = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    patched[key] = { ...(base[key as keyof Telemetry] ?? {}), value: [value] };
  }
  return patched as Telemetry;
};

type SessionEntry = Session['SessionInfo']['Sessions'][number];

// SessionLaps is declared as a string, but iRacing sends a number for a
// fixed-lap session and the string 'unlimited' for a timed one — which is
// exactly what SessionTimingProcessor branches on.
const withRaceLaps = (laps: number | 'unlimited'): Session => {
  const base = sessionFixture as unknown as Session;
  return {
    ...base,
    SessionInfo: {
      ...base.SessionInfo,
      Sessions: base.SessionInfo.Sessions.map((entry) =>
        entry.SessionNum === RACE_SESSION_NUM
          ? ({ ...entry, SessionLaps: laps } as unknown as SessionEntry)
          : entry
      ),
    },
  };
};

/** SDKSessionState.Racing — the mock telemetry fixture defaults to Checkered
 * (5), which would otherwise make every story below hit the post-checkered
 * latch (`total = currentLap`, no "≈") instead of the live projection they're
 * meant to demonstrate. */
const RACING_STATE = 4;

/**
 * A timed race with half an hour left — the case the per-class lap estimate
 * projects from the leader's pace. The fixture's own clock is nearly out, which
 * makes every class project the same lap or two.
 */
export const timedRaceTimingSnapshot: SessionTimingSnapshot = buildSnapshot(
  withRaceLaps('unlimited'),
  withTelemetry({
    SessionTimeRemain: 1800,
    SessionTimeTotal: 3600,
    SessionState: RACING_STATE,
  })
);

/** A 50-lap race: the scheduled distance, so no projection is involved. */
export const fixedLapRaceTimingSnapshot: SessionTimingSnapshot = buildSnapshot(
  withRaceLaps(50),
  withTelemetry({
    SessionTimeRemain: UNLIMITED_SESSION_TIME,
    SessionTimeTotal: UNLIMITED_SESSION_TIME,
    SessionState: RACING_STATE,
  })
);
