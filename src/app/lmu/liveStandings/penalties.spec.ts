import { describe, expect, it } from 'vitest';
import { LMU_PENALTY_CODE } from '@irdashies/types';
import {
  isLmuLiveStandingsFrame,
  lmuLivePenaltyChannels,
  lmuLivePenaltyKind,
  parseLmuLiveStandings,
} from './penalties';

/** A frame in the shape doX's data contract describes. */
const frame = (
  entries: { name: string; dt?: number; sg?: number; time?: number }[]
) =>
  JSON.stringify({
    messageType: 'PUB',
    topic: 'LiveStandings',
    body: {
      entries: entries.map((entry, index) => ({
        driverName: entry.name,
        position: index + 1,
        penalties: {
          DT: entry.dt ?? 0,
          SG: entry.sg ?? 0,
          TIME: entry.time ?? 0,
        },
      })),
    },
  });

/** Parses, or fails the test rather than asserting on a maybe-undefined. */
const mustParse = (text: string) => {
  const parsed = parseLmuLiveStandings(text);
  if (!parsed) throw new Error(`unparseable frame: ${text.slice(0, 80)}`);
  return parsed;
};

describe('parseLmuLiveStandings', () => {
  it('reads a car per entry with its penalties broken out by kind', () => {
    const parsed = mustParse(
      frame([
        { name: 'Alice', dt: 1 },
        { name: 'Bob', sg: 1, time: 10 },
        { name: 'Carol' },
      ])
    );

    expect(parsed?.topic).toBe('LiveStandings');
    expect(parsed?.entries.size).toBe(3);
    expect(parsed?.entries.get('alice')).toEqual({
      driveThrough: 1,
      stopGo: 0,
      timeSeconds: 0,
    });
    expect(parsed?.entries.get('bob')).toEqual({
      driveThrough: 0,
      stopGo: 1,
      timeSeconds: 10,
    });
  });

  it('keeps a clean car as an entry with zeroes', () => {
    // Not an omission: the frame is the whole grid, so a car present with
    // nothing outstanding is how it says the penalty has been served. A
    // consumer has to be able to tell that from the car not being mentioned.
    const parsed = mustParse(frame([{ name: 'Carol' }]));
    expect(parsed?.entries.get('carol')).toEqual({
      driveThrough: 0,
      stopGo: 0,
      timeSeconds: 0,
    });
  });

  it('finds the entries wherever they are nested', () => {
    // The shape is known from what doX asks LMU for, not from a published
    // schema, so this searches rather than indexing a fixed path.
    const nested = JSON.stringify({
      topic: 'LiveStandings',
      payload: {
        standings: {
          rows: [{ Name: 'Alice', Place: 3, Penalties: { dt: 0, sg: 2 } }],
        },
      },
    });
    expect(mustParse(nested)?.entries.get('alice')).toEqual({
      driveThrough: 0,
      stopGo: 2,
      timeSeconds: 0,
    });
  });

  it('accepts the alternative spellings each field has', () => {
    const spelled = JSON.stringify({
      entries: [
        { driver: 'Alice', racePosition: 1, penalty: { driveThru: 1 } },
        { name: 'Bob', place: 2, penalties: { stopAndGo: '1' } },
        { driverName: 'Carol', position: 3, penalties: { penaltyTime: 30 } },
      ],
    });
    const parsed = mustParse(spelled);
    expect(lmuLivePenaltyKind(parsed?.entries.get('alice'))).toBe('DT');
    expect(lmuLivePenaltyKind(parsed?.entries.get('bob'))).toBe('SG');
    expect(lmuLivePenaltyKind(parsed?.entries.get('carol'))).toBe('TIME');
  });

  it('reads a bare count as no kind rather than guessing one', () => {
    // What /rest/watch/standings gives, and what an older build may put here.
    // Knowing a car has a penalty says nothing about which.
    const counted = JSON.stringify({
      entries: [{ driverName: 'Alice', position: 1, penalties: 2 }],
    });
    const parsed = mustParse(counted);
    expect(parsed?.entries.has('alice')).toBe(true);
    expect(lmuLivePenaltyKind(parsed?.entries.get('alice'))).toBeUndefined();
  });

  it("does not mistake the frame's own metadata for a car", () => {
    // A name with no position and no penalties is not an entry.
    const parsed = mustParse(
      JSON.stringify({ topic: 'LiveStandings', name: 'LiveStandings' })
    );
    expect(parsed?.entries.size).toBe(0);
  });

  it('never throws on anything it cannot read', () => {
    expect(parseLmuLiveStandings('not json')).toBeUndefined();
    expect(parseLmuLiveStandings('')).toBeUndefined();
    expect(parseLmuLiveStandings('null')).toBeUndefined();
    expect(parseLmuLiveStandings('[1,2,3]')?.entries.size).toBe(0);
    expect(
      parseLmuLiveStandings('{"entries":[null,3,"x"]}')?.entries.size
    ).toBe(0);
  });

  it('bounds the search so a hostile payload costs a bounded scan', () => {
    // Deeper than the walk goes: it must come back, not recurse forever.
    let deep: Record<string, unknown> = {
      driverName: 'Alice',
      position: 1,
      penalties: { DT: 1 },
    };
    for (let i = 0; i < 200; i += 1) deep = { child: deep };
    const parsed = mustParse(JSON.stringify(deep));
    expect(parsed).toBeDefined();
    expect(parsed?.entries.size).toBe(0);
  });
});

describe('isLmuLiveStandingsFrame', () => {
  it('accepts the topic that was subscribed to, in any casing', () => {
    const parsed = mustParse(frame([{ name: 'Alice' }]));
    expect(isLmuLiveStandingsFrame(parsed)).toBe(true);
  });

  it('accepts an unlabelled frame, which can only be the answer', () => {
    const parsed = mustParse(
      JSON.stringify({ entries: [{ driverName: 'Alice', position: 1 }] })
    );
    expect(isLmuLiveStandingsFrame(parsed)).toBe(true);
  });

  it('rejects another topic, so its frames cannot wipe the grid', () => {
    const other = mustParse(
      JSON.stringify({
        topic: 'Chat',
        entries: [{ driverName: 'Alice', position: 1 }],
      })
    );
    expect(isLmuLiveStandingsFrame(other)).toBe(false);
  });

  it('rejects a frame that describes nobody', () => {
    const empty = mustParse(
      JSON.stringify({ topic: 'LiveStandings', body: {} })
    );
    expect(isLmuLiveStandingsFrame(empty)).toBe(false);
  });
});

describe('lmuLivePenaltyKind', () => {
  it('names each kind', () => {
    expect(
      lmuLivePenaltyKind({ driveThrough: 1, stopGo: 0, timeSeconds: 0 })
    ).toBe('DT');
    expect(
      lmuLivePenaltyKind({ driveThrough: 0, stopGo: 1, timeSeconds: 0 })
    ).toBe('SG');
    expect(
      lmuLivePenaltyKind({ driveThrough: 0, stopGo: 0, timeSeconds: 10 })
    ).toBe('TIME');
  });

  it('serves the one that blocks the others first', () => {
    // A drive-through and a stop-go are served on track; a time penalty is
    // added at the stop. Same order doX's row formatter uses.
    expect(
      lmuLivePenaltyKind({ driveThrough: 1, stopGo: 1, timeSeconds: 30 })
    ).toBe('DT');
    expect(
      lmuLivePenaltyKind({ driveThrough: 0, stopGo: 1, timeSeconds: 30 })
    ).toBe('SG');
  });

  it('says nothing for a clean car or no reading', () => {
    expect(
      lmuLivePenaltyKind({ driveThrough: 0, stopGo: 0, timeSeconds: 0 })
    ).toBeUndefined();
    expect(lmuLivePenaltyKind(undefined)).toBeUndefined();
  });
});

describe('lmuLivePenaltyChannels', () => {
  const roster = [
    { id: 0, name: 'Alice' },
    { id: 5, name: '#42 Bob' },
  ];

  it('indexes by CarIdx, not by position in the grid', () => {
    // CarIdx is the slot id for LMU, which is what every other per-car
    // channel is indexed by -- so slot 5 lands at 5 and the gap stays clean.
    const entries = mustParse(
      frame([
        { name: 'Alice', dt: 1 },
        { name: 'Bob', sg: 1 },
      ])
    ).entries;

    const codes = lmuLivePenaltyChannels(roster, entries).kind.value;
    expect(codes).toHaveLength(6);
    expect(codes[0]).toBe(LMU_PENALTY_CODE.driveThrough);
    expect(codes[5]).toBe(LMU_PENALTY_CODE.stopGo);
    expect(codes[3]).toBe(LMU_PENALTY_CODE.none);
  });

  it('joins across the car number the websocket prefixes', () => {
    const entries = mustParse(frame([{ name: 'Bob', dt: 1 }])).entries;
    expect(lmuLivePenaltyChannels(roster, entries).kind.value[5]).toBe(
      LMU_PENALTY_CODE.driveThrough
    );
  });

  it('leaves a car the feed never mentioned clean', () => {
    const entries = mustParse(frame([{ name: 'Alice', dt: 1 }])).entries;
    expect(lmuLivePenaltyChannels(roster, entries).kind.value[5]).toBe(
      LMU_PENALTY_CODE.none
    );
  });

  it('publishes nothing at all when nothing is known', () => {
    // An empty channel rather than a grid of zeroes: zero means "known
    // clean" to everything downstream, and a silent feed knows nothing.
    expect(lmuLivePenaltyChannels(roster, undefined).kind.value).toEqual([]);
    expect(lmuLivePenaltyChannels(roster, new Map()).kind.value).toEqual([]);
    expect(
      lmuLivePenaltyChannels(
        [],
        mustParse(frame([{ name: 'Alice', dt: 1 }])).entries
      ).kind.value
    ).toEqual([]);
  });
});

describe('lmuLivePenaltyChannels time penalties', () => {
  const roster = [
    { id: 0, name: 'Alice' },
    { id: 1, name: 'Bob' },
    { id: 2, name: 'Carol' },
  ];

  it('reports the seconds a time penalty will add', () => {
    const entries = mustParse(
      frame([{ name: 'Alice', time: 30 }, { name: 'Bob' }])
    ).entries;
    const channels = lmuLivePenaltyChannels(roster, entries);
    expect(channels.kind.value[0]).toBe(LMU_PENALTY_CODE.time);
    expect(channels.penaltySeconds.value[0]).toBe(30);
    expect(channels.penaltySeconds.value[1]).toBe(0);
  });

  it('reports no seconds for a kind that is served on track', () => {
    // A stop-go's own stationary seconds arrive in the same field. Reporting
    // them would put "+30" on a badge whose driver has to stop regardless.
    const entries = mustParse(
      frame([{ name: 'Alice', sg: 1, time: 30 }])
    ).entries;
    const channels = lmuLivePenaltyChannels(roster, entries);
    expect(channels.kind.value[0]).toBe(LMU_PENALTY_CODE.stopGo);
    expect(channels.penaltySeconds.value[0]).toBe(0);
  });

  it('builds both channels to the same length', () => {
    const entries = mustParse(frame([{ name: 'Alice', dt: 1 }])).entries;
    const channels = lmuLivePenaltyChannels(roster, entries);
    expect(channels.penaltySeconds.value).toHaveLength(
      channels.kind.value.length
    );
  });
});
