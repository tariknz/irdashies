import { describe, expect, it } from 'vitest';
import {
  createLmuSessionIdentity,
  lmuSessionUniqueId,
} from './sessionIdentity';
import { mapLmuSession } from './mapSession';
import { mapLmuTelemetry } from './mapTelemetry';
import { fixture as sessionFixture } from './rawSessionFixture';
import { fixture as telemetryFixture } from './rawFixture';

const base = {
  trackName: 'Algarve International Circuit',
  session: 1,
  serverName: 'Some Server',
};

describe('lmuSessionUniqueId', () => {
  it('changes when the track does', () => {
    // The case that showed the bug: both practice, so LMU reported session 1
    // for each and every consumer kept the previous grid.
    expect(lmuSessionUniqueId(base)).not.toBe(
      lmuSessionUniqueId({ ...base, trackName: 'Circuit of the Americas' })
    );
  });

  it('changes between practice, qualifying and the race', () => {
    const ids = [1, 2, 3].map((session) =>
      lmuSessionUniqueId({ ...base, session })
    );
    expect(new Set(ids).size).toBe(3);
  });

  it('separates two servers running the same event', () => {
    // Otherwise they would share stored lap history.
    expect(lmuSessionUniqueId(base)).not.toBe(
      lmuSessionUniqueId({ ...base, serverName: 'Another Server' })
    );
  });

  it('is the same session on a rejoin', () => {
    // Stable rather than unique per join, so reconnecting finds its history.
    expect(lmuSessionUniqueId(base)).toBe(lmuSessionUniqueId({ ...base }));
  });

  it('answers for a single-player session with no server', () => {
    const offline = lmuSessionUniqueId({ trackName: 'Spa', session: 1 });
    expect(offline).toBeGreaterThan(0);
    expect(offline).toBe(
      lmuSessionUniqueId({ trackName: 'Spa', session: 1, serverName: '' })
    );
  });

  it('never returns the reserved zero', () => {
    // ReplayContextProcessor reads 0 as "no session named".
    expect(lmuSessionUniqueId({})).toBeGreaterThan(0);
  });

  it('cannot be confused by a value running into the next', () => {
    expect(lmuSessionUniqueId({ trackName: 'ab', serverName: 'c' })).not.toBe(
      lmuSessionUniqueId({ trackName: 'a', serverName: 'bc' })
    );
  });
});

describe('createLmuSessionIdentity', () => {
  const sample = {
    trackName: 'Algarve International Circuit',
    session: 1,
    serverName: 'Some Server',
    endET: 3600,
    currentET: 100,
    playerLaps: 2,
  };

  it('holds steady while a session runs on', () => {
    const identity = createLmuSessionIdentity();
    const first = identity.observe(sample);
    const later = identity.observe({
      ...sample,
      currentET: 900,
      playerLaps: 7,
    });
    expect(later).toBe(first);
    expect(identity.lastChange()).toBeNull();
  });

  it('declares one when the sim reports a session boundary', () => {
    // Ending an online practice bumps EndSession and changes nothing else:
    // the window stays open, the clock stops rather than resets, and the grid
    // empties one driver at a time. Nothing else here would have noticed.
    const identity = createLmuSessionIdentity();
    const before = identity.observe({
      ...sample,
      sessionStartEvents: 1,
      sessionEndEvents: 0,
    });
    const after = identity.observe({
      ...sample,
      sessionStartEvents: 1,
      sessionEndEvents: 1,
    });
    expect(after).not.toBe(before);
    expect(identity.lastChange()).toBe('event');
  });

  it('declares one when the sim reports a session starting', () => {
    const identity = createLmuSessionIdentity();
    const before = identity.observe({ ...sample, sessionStartEvents: 1 });
    const after = identity.observe({ ...sample, sessionStartEvents: 2 });
    expect(after).not.toBe(before);
    expect(identity.lastChange()).toBe('event');
  });

  it('holds steady while the counters do, clock running on', () => {
    const identity = createLmuSessionIdentity();
    const first = identity.observe({
      ...sample,
      sessionStartEvents: 1,
      sessionEndEvents: 0,
    });
    expect(
      identity.observe({
        ...sample,
        currentET: 2000,
        sessionStartEvents: 1,
        sessionEndEvents: 0,
      })
    ).toBe(first);
    expect(identity.lastChange()).toBeNull();
  });

  it('prefers the sim’s word over the clock heuristic', () => {
    // Both fire at once on a roll; the log should say which it was, and the
    // sim stating it is better evidence than this inferring it.
    const identity = createLmuSessionIdentity();
    identity.observe({ ...sample, currentET: 3500, sessionEndEvents: 0 });
    identity.observe({ ...sample, currentET: 1, sessionEndEvents: 1 });
    expect(identity.lastChange()).toBe('event');
  });

  it('ignores a sim that reports no counters at all', () => {
    // A build that does not fill them falls through to the heuristics.
    const identity = createLmuSessionIdentity();
    const first = identity.observe(sample);
    expect(identity.observe({ ...sample, currentET: 200 })).toBe(first);
    expect(identity.lastChange()).toBeNull();
  });

  it('declares a new session when the clock goes backwards', () => {
    // The case nothing else can see: a server rolling its practice session.
    // Same track, same type, same server, same length -- only the clock says.
    const identity = createLmuSessionIdentity();
    const before = identity.observe({ ...sample, currentET: 3500 });
    const after = identity.observe({ ...sample, currentET: 4 });
    expect(after).not.toBe(before);
    expect(identity.lastChange()).toBe('clock');
  });

  it('declares one when the lap count goes backwards', () => {
    // Catches a roll whose clock happens to land near where the last ended.
    const identity = createLmuSessionIdentity();
    const before = identity.observe({ ...sample, playerLaps: 11 });
    const after = identity.observe({ ...sample, playerLaps: 0 });
    expect(after).not.toBe(before);
    expect(identity.lastChange()).toBe('laps');
  });

  it('tolerates the clock jittering on a 5 Hz source', () => {
    // Scoring publishes at 5 Hz and the loop reads it at 125, so a repeated
    // or slightly stale read is ordinary and must not look like a new session.
    const identity = createLmuSessionIdentity();
    const first = identity.observe({ ...sample, currentET: 100 });
    expect(identity.observe({ ...sample, currentET: 99.2 })).toBe(first);
    expect(identity.observe({ ...sample, currentET: 98.5 })).toBe(first);
    expect(identity.lastChange()).toBeNull();
  });

  it('settles after a roll instead of advancing every tick', () => {
    const identity = createLmuSessionIdentity();
    identity.observe({ ...sample, currentET: 3500 });
    const rolled = identity.observe({ ...sample, currentET: 2 });
    expect(identity.observe({ ...sample, currentET: 3 })).toBe(rolled);
    expect(identity.observe({ ...sample, currentET: 10 })).toBe(rolled);
    expect(identity.lastChange()).toBeNull();
  });

  it('gives each roll its own id, not just the first', () => {
    const identity = createLmuSessionIdentity();
    const seen = new Set<number>();
    for (let roll = 0; roll < 3; roll += 1) {
      identity.observe({ ...sample, currentET: 3500 });
      seen.add(identity.observe({ ...sample, currentET: 1 }));
    }
    expect(seen.size).toBe(3);
  });

  it('declares one when the session length changes', () => {
    // A different length is a different session even at the same type.
    const identity = createLmuSessionIdentity();
    const before = identity.observe(sample);
    const after = identity.observe({ ...sample, endET: 1800 });
    expect(after).not.toBe(before);
    expect(identity.lastChange()).toBe('stamp');
  });

  it('declares one on a track change', () => {
    const identity = createLmuSessionIdentity();
    const before = identity.observe(sample);
    const after = identity.observe({ ...sample, trackName: 'Spa' });
    expect(after).not.toBe(before);
    expect(identity.lastChange()).toBe('stamp');
  });

  it('returns to a session it has already seen', () => {
    // Practice -> race -> practice. The first practice's id comes back, and
    // with it whatever was stored under it, which is the point of a stable id.
    const identity = createLmuSessionIdentity();
    const practice = identity.observe(sample);
    identity.observe({ ...sample, session: 10 });
    expect(identity.observe(sample)).toBe(practice);
  });

  it('ignores a missing player lap count rather than reading it as zero', () => {
    // Spectating or sitting in the garage is not a lap count going backwards.
    const identity = createLmuSessionIdentity();
    const first = identity.observe(sample);
    expect(identity.observe({ ...sample, playerLaps: undefined })).toBe(first);
    expect(identity.observe({ ...sample, playerLaps: 3 })).toBe(first);
  });

  it('has no id before the first observation', () => {
    // Which is why the bridge observes before it maps a session: reading
    // current() first published SubSessionID 0 on the first snapshot of a run,
    // then a spurious session change on the next one.
    const identity = createLmuSessionIdentity();
    expect(identity.current()).toBe(0);
  });

  it('never reports the reserved zero once observed', () => {
    const identity = createLmuSessionIdentity();
    expect(identity.observe({})).toBeGreaterThan(0);
  });

  it('forgets everything on reset', () => {
    const identity = createLmuSessionIdentity();
    identity.observe(sample);
    identity.reset();
    expect(identity.current()).toBe(0);
    expect(identity.lastChange()).toBeNull();
  });
});

describe('both mappers report the same session', () => {
  it('agrees between the frame and the snapshot', () => {
    // Consumers compare WeekendInfo.SubSessionID against SessionUniqueID on
    // the frame. If the two mappers derived it independently they could
    // disagree mid-transition, which would read as a session change on every
    // other tick.
    const identity = createLmuSessionIdentity();
    const raw = sessionFixture();
    identity.observe({
      trackName: raw.trackName,
      session: raw.session,
      serverName: raw.serverName,
      endET: raw.endET,
      currentET: raw.currentET,
      playerLaps: 3,
    });

    const snapshot = mapLmuSession(raw, null, undefined, undefined, identity);
    const frame = mapLmuTelemetry(
      telemetryFixture(),
      undefined,
      undefined,
      undefined,
      identity
    );

    expect(snapshot.WeekendInfo.SubSessionID).toBe(identity.current());
    expect(frame.SessionUniqueID.value[0]).toBe(identity.current());
  });

  it('moves both halves together when a session rolls', () => {
    const identity = createLmuSessionIdentity();
    const raw = sessionFixture();
    const observe = (currentET: number) =>
      identity.observe({
        trackName: raw.trackName,
        session: raw.session,
        serverName: raw.serverName,
        endET: raw.endET,
        currentET,
      });

    observe(3500);
    const before = mapLmuSession(raw, null, undefined, undefined, identity)
      .WeekendInfo.SubSessionID;
    observe(2);
    const after = mapLmuSession(raw, null, undefined, undefined, identity)
      .WeekendInfo.SubSessionID;
    const frameAfter = mapLmuTelemetry(
      telemetryFixture(),
      undefined,
      undefined,
      undefined,
      identity
    ).SessionUniqueID.value[0];

    expect(after).not.toBe(before);
    expect(frameAfter).toBe(after);
  });
});
