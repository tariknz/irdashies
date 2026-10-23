import type { LmuWeatherNode } from '@irdashies/types';
import { parseTeamNationalities } from '../nationality';
import type { LmuRestData } from './state';

/**
 * What to fetch from LMU's REST API, and how to read it.
 *
 * Every piece of knowledge about LMU's JSON shapes lives in this file, and
 * nothing in it does IO or owns a timer -- which is what makes the shapes
 * testable against recorded payloads with no server and no sim. The structure
 * mirrors TinyPedal's RestAPITask/ResOutput, since that is the only
 * documentation of these endpoints that exists.
 *
 * Hard rule: **a parser never throws.** It returns undefined for anything it
 * does not recognise, and the caller keeps the previous value. LMU's payloads
 * change between builds, and a surprise there must cost one missing property,
 * not a dead poller.
 */

/** Where a value lands, which decides whether it forces a session republish. */
export type LmuRestTarget = 'telemetry' | 'session';

export interface LmuRestOutput {
  /** Identifies the value for logging and for the apply step. */
  readonly id: string;
  readonly target: LmuRestTarget;
  /** Returns undefined to leave the current value alone. */
  readonly parse: (payload: unknown) => unknown;
  /** Writes a parsed value into the data object. */
  readonly apply: (data: LmuRestData, value: unknown) => void;
  /**
   * True when the parsed value is already what the data holds, so neither the
   * write nor the republish is needed.
   *
   * Only matters for a `session` target: those bump `revision`, which costs a
   * full snapshot rebuild and a whole-object IPC broadcast. An output whose
   * *body* changes on every poll -- `/rest/watch/standings` carries live
   * positions -- would otherwise force one every poll however static the
   * field it actually reads.
   *
   * Absent for every other output, which means the same as "always changed"
   * and is exactly how they behaved before this existed.
   */
  readonly unchanged?: (data: LmuRestData, value: unknown) => boolean;
}

export interface LmuRestTask {
  readonly id: string;
  readonly path: string;
  /**
   * `once` runs a single time per activation -- session settings and the
   * forecast cannot change mid-session. `repeat` polls, backing off while the
   * response is unchanged.
   */
  readonly mode: 'once' | 'repeat';
  readonly baseIntervalMs: number;
  /**
   * The ceiling this task's interval backs off to, if not REST_MAX_INTERVAL_MS.
   *
   * For a task where noticing a change promptly *is* the feature, rather than
   * one reading a value that sits still for a stint.
   */
  readonly maxIntervalMs?: number;
  /**
   * True when an error response is an ordinary state rather than a fault.
   *
   * Every other path here is one LMU serves whenever the sim is up, so three
   * failures in a row mean something is wrong and the task latches off for the
   * activation. That is exactly wrong for a path whose availability depends on
   * what the viewer is *doing*: the app activates the moment LMU is running,
   * which is usually the main menu, and an endpoint that only answers from the
   * spectator view would be given up on seconds after launch and never
   * retried -- so the feature would appear to do nothing at all.
   *
   * An optional task therefore never latches off. A failure costs no retry and
   * is rescheduled on the same backing-off interval an unchanged body gets, so
   * a path that is absent all session is one cheap loopback probe per ceiling
   * and one log line.
   */
  readonly optional?: boolean;
  readonly outputs: readonly LmuRestOutput[];
}

/** Walks a key path, giving up rather than throwing on anything unexpected. */
export const at = (payload: unknown, keys: readonly string[]): unknown => {
  let current = payload;
  for (const key of keys) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
};

/** LMU's scoring array length, which bounds a slot id. See lmu_struct.h. */
const LMU_MAX_VEHICLES = 104;

/** A finite number, or undefined. Rejects NaN, Infinity, and numeric strings. */
export const finiteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const cell = <T>(value: T): { readonly value: readonly T[] } => ({
  value: [value],
});

/** Reads a plain number at a key path and lands it in a telemetry cell. */
const numberCell = (
  id: string,
  keys: readonly string[],
  set: (data: LmuRestData, value: { readonly value: readonly number[] }) => void
): LmuRestOutput => ({
  id,
  target: 'telemetry',
  parse: (payload) => finiteNumber(at(payload, keys)),
  apply: (data, value) => set(data, cell(value as number)),
});

/** Litres in one US gallon, which is how LMU words a gallon pit-menu entry. */
const LITRES_PER_GALLON = 3.7854118;

/** First number in a string, or undefined. Pit-menu text is "+12.5 gal". */
const firstNumber = (text: unknown): number | undefined => {
  if (typeof text !== 'string') return undefined;
  const match = /-?\d+(?:\.\d+)?/.exec(text);
  return match ? Number(match[0]) : undefined;
};

/**
 * Exactly four finite numbers, in LMU's corner order.
 *
 * LMU reports FL, FR, RL, RR, which is the same order as this repo's own
 * corner loop in mapTelemetry.ts -- so there is no remapping to do here, and
 * nobody should add one. A shorter array is rejected rather than published
 * short, because a consumer indexing corner 3 would read undefined.
 */
const fourCorners = (value: unknown): number[] | undefined => {
  if (!Array.isArray(value) || value.length !== 4) return undefined;
  const corners = value.map(finiteNumber);
  return corners.every((corner): corner is number => corner !== undefined)
    ? (corners as number[])
    : undefined;
};

/**
 * What the next pit stop will put in, from the pit menu.
 *
 * Two units share this one field, which is why the flag travels with it. A
 * Hypercar or LMDh is energy-limited, so its menu offers VIRTUAL ENERGY as a
 * percentage; everything else offers FUEL, as a volume that LMU words in
 * either litres or gallons depending on the player's units. A number that is
 * sometimes a percentage and sometimes litres, with nothing saying which, is
 * a bug waiting to be written downstream.
 */
const refuelTarget = (
  payload: unknown
): { amount: number; isVirtualEnergy: boolean } | undefined => {
  const menu = at(payload, ['pitMenu', 'pitMenu']);
  if (!Array.isArray(menu)) return undefined;

  for (const entry of menu) {
    const name = at(entry, ['name']);

    if (name === 'VIRTUAL ENERGY:') {
      const amount = finiteNumber(Number(at(entry, ['currentSetting'])));
      return amount === undefined
        ? undefined
        : { amount, isVirtualEnergy: true };
    }

    if (name === 'FUEL:') {
      const index = at(entry, ['currentSetting']);
      const settings = at(entry, ['settings']);
      if (typeof index !== 'number' || !Array.isArray(settings)) {
        return undefined;
      }
      const text = at(settings[index], ['text']);
      const amount = firstNumber(text);
      if (amount === undefined) return undefined;
      const isGallons =
        typeof text === 'string' && text.toLowerCase().includes('gal');
      return {
        amount: isGallons ? amount * LITRES_PER_GALLON : amount,
        isVirtualEnergy: false,
      };
    }
  }
  return undefined;
};

/**
 * One session's forecast, as five points across its length.
 *
 * LMU names the points START, NODE_25, NODE_50, NODE_75, FINISH, so `start` is
 * just the index scaled to a fraction of the session. Rain chance arrives as a
 * percentage and is normalised to a 0..1 fraction here, clamped, so a
 * consumer never has to know which convention it came in.
 *
 * All five or nothing: a partial forecast would render as a cliff rather than
 * a gap.
 */
const FORECAST_NODES = ['START', 'NODE_25', 'NODE_50', 'NODE_75', 'FINISH'];

const forecast = (payload: unknown): LmuWeatherNode[] | undefined => {
  const nodes: LmuWeatherNode[] = [];
  for (let index = 0; index < FORECAST_NODES.length; index += 1) {
    const node = at(payload, [FORECAST_NODES[index]]);
    const skyType = finiteNumber(at(node, ['WNV_SKY', 'currentValue']));
    const temperature = finiteNumber(
      at(node, ['WNV_TEMPERATURE', 'currentValue'])
    );
    const rawChance = finiteNumber(
      at(node, ['WNV_RAIN_CHANCE', 'currentValue'])
    );
    if (
      skyType === undefined ||
      temperature === undefined ||
      rawChance === undefined
    ) {
      return undefined;
    }
    nodes.push({
      start: Math.round(index * 0.2 * 10) / 10,
      skyType: Math.trunc(skyType),
      temperature,
      rainChance: Math.min(Math.max(rawChance * 0.01, 0), 1),
    });
  }
  return nodes;
};

/** A forecast for one session type, landed under LmuRest.forecast. */
const forecastFor = (
  id: string,
  key: string,
  slot: 'practice' | 'qualify' | 'race'
): LmuRestOutput => ({
  id,
  target: 'session',
  parse: (payload) => forecast(at(payload, [key])),
  apply: (data, value) => {
    data.session.forecast = {
      ...data.session.forecast,
      [slot]: value as LmuWeatherNode[],
    };
  },
});

/** A session setting, which LMU nests under `currentValue`. */
const sessionSetting = (
  id: string,
  key: string,
  apply: (data: LmuRestData, value: number) => void
): LmuRestOutput => ({
  id,
  target: 'session',
  parse: (payload) => finiteNumber(at(payload, [key, 'currentValue'])),
  apply: (data, value) => apply(data, value as number),
});

/**
 * A garage setup value, which LMU nests under `stringValue`.
 *
 * These are display strings rather than numbers -- "0.83", "19.1L (7.8 laps)",
 * "23% (7.7 laps)" -- so the leading number is what carries the data. The
 * sibling `value` field is the slider index, not the quantity, and is no use
 * here.
 */
const garageNumber = (payload: unknown, key: string): number | undefined =>
  firstNumber(at(payload, ['carSetup', 'garageValues', key, 'stringValue']));

/**
 * Driver nationalities, which only multiplayer reports.
 *
 * Returns undefined rather than an empty map when nothing parses, so the
 * "parser found nothing" case leaves any previous value alone instead of
 * wiping the flags -- the same contract every other output here follows.
 */
const nationalities: LmuRestOutput = {
  id: 'nationalities',
  target: 'session',
  parse: (payload) => {
    const found = parseTeamNationalities(payload);
    return found.size > 0 ? Object.fromEntries(found) : undefined;
  },
  apply: (data, value) => {
    data.session.nationalities = value as Record<string, string>;
  },
};

/**
 * The session's tyre compounds, in the order the sim indexes them.
 *
 * `optimalCompoundConditions.compounds` is a list, and a compound's position
 * in it is the index per-wheel telemetry reports -- which makes this the
 * catalogue that turns an index into a name. Each entry also carries an
 * optimal temperature; only the type is taken, since nothing reads the rest.
 *
 * More complete than what the grid states, because it includes compounds
 * nobody has fitted, and less authoritative for the same reason: what a car is
 * actually on comes from its own telemetry block. `lmuDriverTires` merges the
 * grid over this.
 *
 * Returns undefined rather than [] when nothing parses, so a payload this
 * build does not recognise leaves the previous catalogue alone.
 */
const compoundCatalogue: LmuRestOutput = {
  id: 'compoundCatalogue',
  // Session, not telemetry: the catalogue is fixed for a session, and a
  // telemetry target would rebuild the session on every poll.
  target: 'session',
  parse: (payload) => {
    const compounds = at(payload, ['optimalCompoundConditions', 'compounds']);
    if (!Array.isArray(compounds)) return undefined;
    const names = compounds.map((entry) => {
      const type = at(entry, ['type']);
      return typeof type === 'string' ? type : '';
    });
    // Holes are kept rather than filtered: position in this array *is* the
    // compound index, so dropping an unparseable entry would renumber every
    // compound after it.
    return names.some((name) => name.length > 0) ? names : undefined;
  },
  apply: (data, value) => {
    data.session.tireCompounds = value as string[];
  },
};

/**
 * The slot the spectator camera is on, or -1 for none.
 *
 * LMU's shared memory has no camera field at all -- `LMUTelemetryData` carries
 * `playerVehicleIdx` and nothing else, and while spectating `playerHasVehicle`
 * is false, so the player index is -1 and there is nothing for the focus to
 * fall back to. This endpoint is the only route to the watched car.
 *
 * Found in LMUTraceHUB, which reads `/rest/watch/focus` alongside
 * `focusForward` and `focusBackward` and keeps the result in a `CameraInfo`
 * carrying a `FocusSlot`. The literal `mID` sits next to the path in its
 * string table, which matters: `mID` is the scoring slot id, and that is this
 * app's CarIdx (lmu_node.cc indexes every per-vehicle array by `v.mID`). So
 * the answer needs no join -- it drops straight into CamCarIdx.
 *
 * doX reaches the same fact the long way round, from the `focus` flag on each
 * `/rest/watch/standings` entry, then matching driver names. That works and is
 * confirmed by two implementations, but it pays for the whole field to learn
 * one integer.
 *
 * Several spellings are accepted because the response shape is known from a
 * string table rather than a schema, and a bare number is accepted too.
 *
 * -1 is a value, not a failure: it means nothing is focused, and the mapper
 * falls back to the player. Anything unrecognised returns undefined so the
 * previous value stands, which is the contract every parser here follows --
 * a hiccup must not drop the camera back to the player's empty slot mid-lap.
 */
const FOCUS_KEYS = ['mID', 'mid', 'id', 'slot', 'focusSlot', 'carIdx', 'index'];

const focusSlot = (payload: unknown): number | undefined => {
  let found: unknown = typeof payload === 'number' ? payload : undefined;
  if (found === undefined && payload !== null && typeof payload === 'object') {
    const node = payload as Record<string, unknown>;
    const keys = Object.keys(node);
    for (const name of FOCUS_KEYS) {
      const key = keys.find(
        (candidate) => candidate.toLowerCase() === name.toLowerCase()
      );
      if (key !== undefined) {
        found = node[key];
        break;
      }
    }
  }

  const slot = typeof found === 'string' ? Number(found) : found;
  if (typeof slot !== 'number' || !Number.isInteger(slot)) return undefined;
  return slot >= -1 && slot < LMU_MAX_VEHICLES ? slot : undefined;
};

/**
 * The entrant each car is run by, from `/rest/watch/standings`.
 *
 * `fullTeamName` is the only authoritative source. Shared memory has no team
 * field at all, and the fallback -- parsing the prefix of the entry name --
 * carries the season with it: an entry named "Proton Competition 2026 #77:LM"
 * parses as "Proton Competition 2026" where this endpoint states "Proton
 * Competition".
 *
 * Keyed by `slotID`, which is the scoring slot id and so this app's CarIdx --
 * confirmed by the spectator camera, whose `/rest/watch/focus` answer is a
 * slotID and lands on the right car when published as CamCarIdx.
 *
 * By slot rather than by driver name, unlike `nationalities` next door, and
 * the difference is not arbitrary: a team runs a *car*, while the driver in it
 * changes at every stop of an endurance race. A name key would go stale on
 * each swap until the next poll, and would collide between two AI given the
 * same name. The slot is the thing the team belongs to.
 *
 * Returns undefined rather than an empty map when nothing parses, so a build
 * whose payload this does not recognise keeps the previous answer instead of
 * clearing every team name.
 */
const teamNames = (payload: unknown): Record<number, string> | undefined => {
  if (!Array.isArray(payload)) return undefined;

  const found: Record<number, string> = {};
  for (const entry of payload) {
    const slot = at(entry, ['slotID']);
    const team = at(entry, ['fullTeamName']);
    if (typeof team !== 'string') continue;
    // Bounded like the focus slot, and for the same reason: anything outside
    // the scoring array cannot be a car, and would key an entry nothing reads.
    if (typeof slot !== 'number' || !Number.isInteger(slot)) continue;
    if (slot < 0 || slot >= LMU_MAX_VEHICLES) continue;
    const value = team.trim();
    if (value.length === 0) continue;
    found[slot] = value;
  }
  return Object.keys(found).length > 0 ? found : undefined;
};

/** Whether two slot->team maps say the same thing. */
const sameTeams = (
  a: Record<number, string> | undefined,
  b: Record<number, string>
): boolean => {
  if (!a) return false;
  const keys = Object.keys(a);
  // The count as well as the values: every slot already held still matches
  // when a car joins, so only the count says one has appeared.
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[Number(key)] === b[Number(key)]);
};

export const LMU_REST_TASKS: readonly LmuRestTask[] = [
  {
    id: 'repair-and-refuel',
    path: '/rest/garage/UIScreen/RepairAndRefuel',
    mode: 'repeat',
    // The pit menu is static for most of a stint, so the backoff carries this
    // out to the cap; the base rate is for when the driver is actually in it.
    baseIntervalMs: 200,
    outputs: [
      {
        id: 'refuelTarget',
        target: 'telemetry',
        parse: refuelTarget,
        apply: (data, value) => {
          const { amount, isVirtualEnergy } = value as {
            amount: number;
            isVirtualEnergy: boolean;
          };
          data.cells.refuelTarget = { value: [amount] };
          data.cells.refuelTargetIsVirtualEnergy = {
            value: [isVirtualEnergy],
          };
        },
      },
      {
        id: 'maxVirtualEnergy',
        // Session, not telemetry: it is a per-car constant, and a telemetry
        // target here would force a session rebuild on every poll.
        target: 'session',
        parse: (payload) =>
          finiteNumber(at(payload, ['fuelInfo', 'maxVirtualEnergy'])),
        apply: (data, value) => {
          data.session.maxVirtualEnergy = value as number;
        },
      },
      {
        id: 'maxFuel',
        target: 'session',
        // The tank, in litres, stated outright. Every other route to it is an
        // inference: the garage slider's bound has to be read as litres, and
        // mFuelCapacity is shared memory's word for it. A GT3 capture has all
        // three agreeing at 120, and this is the one that says so directly.
        parse: (payload) => finiteNumber(at(payload, ['fuelInfo', 'maxFuel'])),
        apply: (data, value) => {
          data.session.maxFuel = value as number;
        },
      },
      numberCell('aeroDamage', ['wearables', 'body', 'aero'], (data, value) => {
        data.cells.aeroDamage = value;
      }),
      {
        id: 'brakeWear',
        target: 'telemetry',
        parse: (payload) => fourCorners(at(payload, ['wearables', 'brakes'])),
        apply: (data, value) => {
          data.cells.brakeWear = { value: value as number[] };
        },
      },
      {
        id: 'suspensionDamage',
        target: 'telemetry',
        parse: (payload) =>
          fourCorners(at(payload, ['wearables', 'suspension'])),
        apply: (data, value) => {
          data.cells.suspensionDamage = { value: value as number[] };
        },
      },
    ],
  },
  {
    id: 'car-setup-overview',
    path: '/rest/garage/UIScreen/CarSetupOverview',
    // Repeating, because a setup can be edited mid-session and a one-shot
    // would go stale. The payload is the largest in the set, so this leans on
    // the hash compare: unchanged bodies are never parsed, and the backoff
    // carries an untouched setup out to the cap.
    mode: 'repeat',
    baseIntervalMs: 1000,
    outputs: [
      {
        id: 'fuelRatio',
        target: 'session',
        parse: (payload) => garageNumber(payload, 'VM_FUEL_LEVEL'),
        apply: (data, value) => {
          data.session.fuelRatio = value as number;
        },
      },
      {
        id: 'fuelLevelMax',
        target: 'session',
        // maxValue, not stringValue: the top step of the fuel-ratio slider.
        //
        // The ratio is litres per percent of virtual energy, so at the top
        // step a full energy load fills the tank exactly -- which makes this
        // bound the tank in litres. A GT3 capture reads 120 here against a
        // 120 L tank, while the slider's current position reads 1.03.
        parse: (payload) =>
          finiteNumber(
            at(payload, [
              'carSetup',
              'garageValues',
              'VM_FUEL_LEVEL',
              'maxValue',
            ])
          ),
        apply: (data, value) => {
          data.session.fuelLevelMax = value as number;
        },
      },
    ],
  },
  {
    id: 'sessions',
    path: '/rest/sessions',
    // Session settings cannot change mid-session, so this is fetched once per
    // activation and again on a track change.
    mode: 'once',
    baseIntervalMs: 1000,
    outputs: [
      sessionSetting('timeScale', 'SESSSET_race_timescale', (data, value) => {
        data.session.timeScale = value;
      }),
      sessionSetting(
        'privateQualifying',
        'SESSSET_private_qual',
        (data, value) => {
          data.session.privateQualifying = value !== 0;
        }
      ),
    ],
  },
  {
    id: 'sessions-weather',
    path: '/rest/sessions/weather',
    mode: 'once',
    baseIntervalMs: 1000,
    outputs: [
      forecastFor('forecastPractice', 'PRACTICE', 'practice'),
      forecastFor('forecastQualify', 'QUALIFY', 'qualify'),
      forecastFor('forecastRace', 'RACE', 'race'),
    ],
  },
  {
    id: 'multiplayer-teams',
    path: '/rest/multiplayer/teams',
    // The entry list is fixed once a session is joined, so this is fetched
    // once per activation like the other roster-shaped payloads. A driver
    // joining mid-session is picked up at the next activation rather than
    // polled for -- a flag appearing a session late is a fair trade against
    // re-fetching the whole roster on a timer.
    mode: 'once',
    baseIntervalMs: 2000,
    outputs: [nationalities],
  },
  {
    id: 'tire-management',
    path: '/rest/garage/UIScreen/TireManagement',
    // Once per activation, like the other session-fixed payloads: the
    // compounds a car can run do not change inside a session.
    mode: 'once',
    baseIntervalMs: 2000,
    outputs: [compoundCatalogue],
  },
  {
    id: 'watch-standings',
    path: '/rest/watch/standings',
    mode: 'repeat',
    // Ten seconds, which is far slower than anything else here, and
    // deliberately so. This payload is the whole field with live positions,
    // velocities and lap fractions in it, so its body differs on every poll
    // however static the team names are -- the hash compare that makes the
    // other repeating tasks nearly free can never match, and the backoff can
    // never climb. Every poll therefore pays for a JSON.parse of tens of
    // kilobytes, and the only lever left is how often.
    //
    // Ten seconds is also enough to pick up a driver swap, which is the one
    // thing a `once` task would miss: the team is fixed per entry, but which
    // driver is in the car is not.
    baseIntervalMs: 10_000,
    // LMU serves this only once a session is live.
    optional: true,
    outputs: [
      {
        id: 'teamNames',
        target: 'session',
        parse: teamNames,
        // Almost always true: the teams are static for a session while the
        // body around them moves constantly. Without this, a session target
        // on such a body would rebuild the whole snapshot and broadcast it
        // every ten seconds, which is the hitch this endpoint is known for.
        unchanged: (data, value) =>
          sameTeams(data.session.teamNames, value as Record<number, string>),
        apply: (data, value) => {
          data.session.teamNames = value as Record<number, string>;
        },
      },
    ],
  },
  {
    id: 'watch-focus',
    path: '/rest/watch/focus',
    mode: 'repeat',
    // Fast, because this is the only channel that says which car the overlays
    // are about and it changes the instant the viewer presses a key. Cheap
    // enough to afford: the payload is one integer and the hash compare
    // rejects an unchanged body before any parsing.
    baseIntervalMs: 250,
    // A second, not the usual five. The backoff exists to stop re-reading a
    // pit menu nobody is touching; here, noticing the change promptly is the
    // whole feature, and taking five seconds to follow the camera would read
    // as not following it.
    maxIntervalMs: 1000,
    // LMU answers this only from the spectator view. Without this the task
    // would latch off three seconds after launch -- at the main menu, long
    // before anyone starts watching -- and never poll again.
    optional: true,
    outputs: [
      {
        id: 'focusCarIdx',
        // Telemetry, not session: the camera moves during a session, and a
        // session target would rebuild the whole snapshot on every change.
        target: 'telemetry',
        parse: focusSlot,
        apply: (data, value) => {
          data.cells.focusCarIdx = { value: [value as number] };
        },
      },
    ],
  },
  {
    id: 'pitstop-estimate',
    path: '/rest/strategy/pitstop-estimate',
    mode: 'repeat',
    // A second is plenty: the estimate only moves when damage or the pit menu
    // changes, and the backoff takes it further out while it is static.
    baseIntervalMs: 1000,
    outputs: [
      numberCell('pitStopTime', ['total'], (data, value) => {
        data.cells.pitStopTime = value;
      }),
      numberCell('repairTime', ['damage'], (data, value) => {
        data.cells.repairTime = value;
      }),
      numberCell('penaltySeconds', ['penalties'], (data, value) => {
        data.cells.penaltySeconds = value;
      }),
    ],
  },
];
