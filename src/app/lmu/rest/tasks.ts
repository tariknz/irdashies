import type { LmuWeatherNode } from '@irdashies/types';
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
    ],
  },
];
